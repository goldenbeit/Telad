-- Buyer-request desk: team tree, request flow with time limits, notes, history and in-app alerts.
-- Everything goes through SECURITY DEFINER RPCs; the tables themselves are closed to anon/authenticated.

-- ---------- team ----------
create table public.staff (
  id bigint generated always as identity primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  phone text not null unique check (phone ~ '^01[0125][0-9]{8}$'),
  role text not null check (role in ('junior','senior','sup','tl','sadmin','web','gm')),
  parent_id bigint references public.staff(id) on delete set null,
  active boolean not null default true,
  avail boolean not null default true,
  code_hash text,
  code_expires timestamptz,
  code_tries int not null default 0,
  created_at timestamptz not null default now()
);
create index staff_parent_idx on public.staff (parent_id);

-- ---------- requests: new columns for the flow ----------
alter table public.requests alter column name drop not null, alter column phone drop not null;
alter table public.requests
  add column via text not null default 'form' check (via in ('form','wa','ask')),
  add column stage text not null default 'new' check (stage in ('new','tl','sup','sales','up_sup','up_tl','up_sa','closed')),
  add column tl_id bigint references public.staff(id) on delete set null,
  add column sup_id bigint references public.staff(id) on delete set null,
  add column sales_id bigint references public.staff(id) on delete set null,
  add column tl_mode text not null default 'confirm' check (tl_mode in ('confirm','info')),
  add column tl_ack boolean not null default false,
  add column st_key text,
  add column st_at timestamptz,
  add column st_due timestamptz,
  add column outcome text check (outcome in ('sold','deposit','follow','lost')),
  add column outcome_reason text check (char_length(outcome_reason) <= 200),
  add column outcome_summary text check (char_length(outcome_summary) <= 1000),
  add column first_at timestamptz,
  add column closed_at timestamptz,
  add column web_task boolean not null default false;
update public.requests set via = case when kind = 'ask' then 'ask' else 'form' end,
  stage = case when state = 'closed' then 'closed' else 'new' end,
  closed_at = case when state = 'closed' then now() end;
alter table public.requests add constraint requests_contact_required check (via = 'wa' or (phone is not null and name is not null));
create index requests_stage_idx on public.requests (stage, created_at desc);

create table public.request_legs (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.requests(id) on delete cascade,
  staff_id bigint references public.staff(id) on delete set null,
  role text,
  kind text not null default 't' check (kind in ('t','s')),
  label text,
  started_at timestamptz not null default now(),
  due_at timestamptz,
  ended_at timestamptz
);
create index request_legs_req_idx on public.request_legs (request_id);
create table public.request_notes (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.requests(id) on delete cascade,
  staff_id bigint references public.staff(id) on delete set null,
  by_owner boolean not null default false,
  kind text not null default 'note' check (kind in ('note','instr')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index request_notes_req_idx on public.request_notes (request_id);
create table public.request_events (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.requests(id) on delete cascade,
  staff_id bigint references public.staff(id) on delete set null,
  by_owner boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index request_events_req_idx on public.request_events (request_id);
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id bigint references public.requests(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.staff enable row level security;
alter table public.request_legs enable row level security;
alter table public.request_notes enable row level security;
alter table public.request_events enable row level security;
alter table public.notifications enable row level security;
revoke all on public.staff, public.request_legs, public.request_notes, public.request_events, public.notifications from anon, authenticated;

-- ---------- who is calling ----------
create or replace function public._me() returns public.staff
language sql stable security definer set search_path = ''
as $$ select s.* from public.staff s where s.user_id = (select auth.uid()) and s.active limit 1; $$;
create or replace function public._role() returns text
language sql stable security definer set search_path = ''
as $$ select case when public.is_admin() then 'owner' else (select s.role from public.staff s where s.user_id = (select auth.uid()) and s.active limit 1) end; $$;
create or replace function public._actor() returns text
language sql stable security definer set search_path = ''
as $$ select case when public.is_admin() then 'الأدمن' else coalesce((select s.name from public.staff s where s.user_id = (select auth.uid()) limit 1), '—') end; $$;

-- users to alert: one staff member, or everyone in a role group (the owner is in the sadmin/web/gm groups)
create or replace function public._users_of(p_role text) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(distinct u), '{}') from (
  select s.user_id u from public.staff s where s.role = p_role and s.active and s.user_id is not null
  union select a.user_id from public.admins a where p_role in ('sadmin','web','gm')) x; $$;
create or replace function public._user_of(p_staff bigint) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(s.user_id), '{}') from public.staff s where s.id = p_staff and s.active and s.user_id is not null; $$;
create or replace function public._notify(p_users uuid[], p_req bigint, p_body text) returns void
language sql security definer set search_path = ''
as $$ insert into public.notifications (user_id, request_id, body)
  select distinct u, p_req, p_body from unnest(p_users) u where u is not null and u is distinct from (select auth.uid()); $$;
create or replace function public._event(p_req bigint, p_body text) returns void
language sql security definer set search_path = ''
as $$ insert into public.request_events (request_id, staff_id, by_owner, body) values (p_req, (public._me()).id, public.is_admin(), p_body); $$;
create or replace function public._leg(p_req bigint, p_staff bigint, p_role text, p_mins int) returns void
language sql security definer set search_path = ''
as $$ insert into public.request_legs (request_id, staff_id, role, due_at) values (p_req, p_staff, p_role, case when p_mins is null then null else now() + make_interval(mins => p_mins) end); $$;
create or replace function public._close_legs(p_req bigint) returns void
language sql security definer set search_path = ''
as $$ update public.request_legs set ended_at = now() where request_id = p_req and kind = 't' and ended_at is null; $$;

create or replace function public._st_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'call_buyer' then 'تواصلنا مع المشتري' when 'no_answer' then 'المشتري مش بيرد' when 'confirmed' then 'اتأكدنا من الطلب والميزانية'
  when 'call_seller' then 'تواصلنا مع البائع' when 'available' then 'البائع أكّد إن القطعة متاحة' when 'options' then 'بعتنا اختيارات للمشتري'
  when 'visit_set' then 'اتحدد معاد معاينة' when 'visited' then 'المعاينة تمت' when 'nego' then 'بنتفاوض على السعر' when 'deposit' then 'اتدفع عربون'
  when 'contract' then 'اتمضى العقد' when 'later' then 'المشتري طلب نأجّل' end; $$;
create or replace function public._out_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'sold' then 'اتباع' when 'deposit' then 'اتدفع عربون' when 'follow' then 'محتاج متابعة' when 'lost' then 'اتقفل من غير بيع' end; $$;
create or replace function public._is_under(p_child bigint, p_parent bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ with recursive up as (select id, parent_id, 0 d from public.staff where id = p_child
  union all select s.id, s.parent_id, up.d + 1 from public.staff s join up on s.id = up.parent_id where up.d < 10)
  select exists (select 1 from up where parent_id = p_parent); $$;
create or replace function public._req_title(r public.requests) returns text
language sql stable security definer set search_path = ''
as $$ select case when r.via = 'ask' then 'طلب بيدوّر على قطعة R-' || r.id
  else (case when r.via = 'wa' then 'واتساب على ' else 'طلب ' end) || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')' end; $$;

-- ---------- a new request starts the clock and alerts the admins ----------
create or replace function public._req_new() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.stage <> 'new' then return new; end if;
  insert into public.request_legs (request_id, role, due_at) values (new.id, 'sadmin', now() + interval '60 minutes');
  insert into public.request_events (request_id, body) values (new.id,
    case new.via when 'wa' then 'عميل داس واتساب على القطعة' when 'ask' then 'وصل طلب "بيدوّر على قطعة" من الموقع' else 'وصل طلب "اطلبها" من صفحة القطعة' end);
  perform public._notify(public._users_of('sadmin') || case when new.via = 'ask' then '{}'::uuid[] else public._users_of('web') end, new.id,
    case new.via when 'wa' then 'عميل كلّمنا واتساب: ' else 'طلب جديد: ' end || public._req_title(new));
  return new;
end $$;
create trigger requests_new after insert on public.requests for each row execute function public._req_new();
-- requests from the old "looking for a unit" form keep their own type
create or replace function public._req_via() returns trigger
language plpgsql set search_path = ''
as $$ begin new.via := case when new.kind = 'ask' then 'ask' when new.via = 'wa' then 'wa' else 'form' end; return new; end $$;
create trigger requests_via before insert on public.requests for each row execute function public._req_via();

-- WhatsApp tap on a unit page: opens a request with no phone yet (written later from the chat).
create or replace function public.wa_click(p_listing bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.listings where id = p_listing and state = 'approved') then return; end if;
  if (select count(*) from public.requests where via = 'wa' and listing_id = p_listing and created_at > now() - interval '1 hour') >= 20 then return; end if;
  if (select count(*) from public.requests where via = 'wa' and created_at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.requests (kind, listing_id, via) values ('unit', p_listing, 'wa');
end $$;

-- ---------- profile and team ----------
create or replace function public.desk_me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.staff := public._me();
begin
  if public.is_admin() then return jsonb_build_object('owner', true, 'role', 'owner', 'name', 'الأدمن', 'id', null); end if;
  if s.id is null then return null; end if;
  return jsonb_build_object('owner', false, 'id', s.id, 'name', s.name, 'role', s.role, 'avail', s.avail, 'parent_id', s.parent_id);
end $$;

create or replace function public.desk_staff() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r text := public._role();
begin
  if r is null then raise exception 'not_staff' using errcode = '42501'; end if;
  return query select jsonb_build_object('id', s.id, 'name', s.name, 'role', s.role, 'parent_id', s.parent_id, 'active', s.active, 'avail', s.avail,
      'activated', s.user_id is not null, 'phone', case when r in ('owner','sadmin') then s.phone end,
      'code_pending', r = 'owner' and s.user_id is null and s.code_expires > now())
    from public.staff s order by s.id;
end $$;

create or replace function public._parent_ok(p_role text, p_parent bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select case
  when p_role = 'gm' then p_parent is null
  when p_role in ('sadmin','web') then p_parent is null or exists (select 1 from public.staff where id = p_parent and role = 'gm')
  else exists (select 1 from public.staff where id = p_parent and role = case p_role when 'junior' then 'senior' when 'senior' then 'sup' when 'sup' then 'tl' when 'tl' then 'sadmin' end) end; $$;

-- returns a 6-digit invite code the owner gives the member; only its hash is stored
create or replace function public._new_code(p_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
declare c text := lpad((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
begin
  update public.staff set code_hash = encode(extensions.digest(c, 'sha256'), 'hex'), code_expires = now() + interval '7 days', code_tries = 0 where id = p_id;
  return c;
end $$;

create or replace function public.staff_add(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_role text := p->>'role'; v_parent bigint := nullif(p->>'parent_id','')::bigint; v_phone text := p->>'phone';
begin
  if not public.is_admin() then raise exception 'not_owner' using errcode = '42501'; end if;
  if v_role not in ('junior','senior','sup','tl','sadmin','web','gm') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if coalesce(v_phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if not public._parent_ok(v_role, v_parent) then raise exception 'invalid_parent' using errcode = '22023'; end if;
  if exists (select 1 from public.staff where phone = v_phone) then raise exception 'phone_taken' using errcode = '23505'; end if;
  insert into public.staff (name, phone, role, parent_id) values (btrim(p->>'name'), v_phone, v_role, v_parent) returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', public._new_code(v_id));
end $$;

create or replace function public.staff_update(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.staff;
begin
  if not public.is_admin() then raise exception 'not_owner' using errcode = '42501'; end if;
  select * into s from public.staff where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if p ? 'parent_id' then
    if not public._parent_ok(s.role, nullif(p->>'parent_id','')::bigint) then raise exception 'invalid_parent' using errcode = '22023'; end if;
    update public.staff set parent_id = nullif(p->>'parent_id','')::bigint where id = p_id;
  end if;
  if p ? 'active' then update public.staff set active = (p->>'active')::boolean where id = p_id; end if;
  if p ? 'name' then update public.staff set name = btrim(p->>'name') where id = p_id; end if;
end $$;

create or replace function public.staff_new_code(p_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_owner' using errcode = '42501'; end if;
  if not exists (select 1 from public.staff where id = p_id and user_id is null) then raise exception 'already_active' using errcode = '22023'; end if;
  return public._new_code(p_id);
end $$;

create or replace function public.staff_set_avail(p_avail boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (public._me()).id is null then raise exception 'not_staff' using errcode = '42501'; end if;
  update public.staff set avail = p_avail where id = (public._me()).id;
end $$;

-- ---------- requests: list and detail ----------
create or replace function public._can_see(r public.requests) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(case public._role()
  when 'owner' then true when 'sadmin' then true when 'gm' then true
  when 'web' then r.via <> 'ask'
  when 'tl' then r.tl_id = (public._me()).id
  when 'sup' then r.sup_id = (public._me()).id
  when 'junior' then r.sales_id = (public._me()).id
  when 'senior' then r.sales_id = (public._me()).id
  else false end, false); $$;

create or replace function public.desk_requests() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public._role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  return query select jsonb_build_object('id', r.id, 'via', r.via, 'stage', r.stage, 'name', r.name, 'phone', r.phone, 'listing_id', r.listing_id,
      'zone', r.zone, 'district', r.district, 'budget', r.budget, 'created_at', r.created_at,
      'tl_id', r.tl_id, 'sup_id', r.sup_id, 'sales_id', r.sales_id, 'tl_mode', r.tl_mode, 'tl_ack', r.tl_ack,
      'st_key', r.st_key, 'st_at', r.st_at, 'st_due', r.st_due, 'outcome', r.outcome, 'outcome_reason', r.outcome_reason, 'outcome_summary', r.outcome_summary,
      'first_at', r.first_at, 'closed_at', r.closed_at, 'web_task', r.web_task,
      'code', l.code, 'l_district', l.district, 'l_zone', l.zone, 'l_area', coalesce(l.area_final, l.area_orig), 'l_price', l.price, 'l_paid', l.paid,
      'notes', (select count(*) from public.request_notes n where n.request_id = r.id),
      'legs', coalesce((select jsonb_agg(jsonb_build_object('staff_id', g.staff_id, 'role', g.role, 'kind', g.kind, 'label', g.label, 'start', g.started_at, 'due', g.due_at, 'end', g.ended_at) order by g.id)
        from public.request_legs g where g.request_id = r.id), '[]'::jsonb))
    from public.requests r left join public.listings l on l.id = r.listing_id
    where public._can_see(r) order by r.created_at desc;
end $$;

create or replace function public.desk_request(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.requests;
begin
  select * into r from public.requests where id = p_id;
  if r.id is null or not public._can_see(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'notes', coalesce((select jsonb_agg(jsonb_build_object('who', case when n.by_owner then 'الأدمن' else s.name end, 'role', s.role, 'kind', n.kind, 'body', n.body, 'at', n.created_at) order by n.id)
      from public.request_notes n left join public.staff s on s.id = n.staff_id where n.request_id = p_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('who', case when e.by_owner then 'الأدمن' else s.name end, 'body', e.body, 'at', e.created_at) order by e.id desc)
      from public.request_events e left join public.staff s on s.id = e.staff_id where e.request_id = p_id), '[]'::jsonb));
end $$;

-- ---------- every action on a request ----------
create or replace function public.desk_act(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests; me public.staff := public._me(); v_role text := public._role(); who text := public._actor();
  a text := p->>'a'; mins int := nullif(p->>'mins','')::int; note text := nullif(btrim(coalesce(p->>'note','')), '');
  t text; v_sup public.staff; v_sales public.staff; v_out text; k text;
begin
  if v_role is null then raise exception 'not_staff' using errcode = '42501'; end if;
  select * into r from public.requests where id = p_id for update;
  if r.id is null or not public._can_see(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if mins is not null and (mins < 5 or mins > 10080) then raise exception 'invalid_mins' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  t := public._req_title(r);

  if a = 'note' then
    if v_role = 'gm' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if note is null then raise exception 'note_required' using errcode = '22023'; end if;
    insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', case when p->>'kind' = 'instr' then 'instr' else 'note' end, note);
    perform public._event(r.id, 'ضاف ' || case when p->>'kind' = 'instr' then 'تعليمات' else 'ملحوظة' end);
    perform public._notify(case r.stage when 'new' then public._users_of('sadmin') when 'up_sa' then public._users_of('sadmin') when 'tl' then public._user_of(r.tl_id)
      when 'up_tl' then public._user_of(r.tl_id) when 'sup' then public._user_of(r.sup_id) when 'up_sup' then public._user_of(r.sup_id) when 'sales' then public._user_of(r.sales_id) else '{}' end,
      r.id, who || ' ضاف ملحوظة على ' || t || ': ' || left(note, 120));
    return;
  end if;

  if a = 'phone' then
    if v_role not in ('owner','sadmin','web') or r.via <> 'wa' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if coalesce(p->>'phone','') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
    update public.requests set phone = p->>'phone', name = coalesce(nullif(btrim(coalesce(p->>'name','')), ''), name, 'عميل واتساب') where id = r.id;
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'note', note); end if;
    perform public._event(r.id, 'كتب رقم العميل من محادثة الواتساب');
    return;
  end if;

  if a = 'forward' then
    if v_role not in ('owner','sadmin') or r.stage <> 'new' or r.via = 'ask' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if r.phone is null then raise exception 'phone_required' using errcode = '22023'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    select * into v_sup from public.staff where id = nullif(p->>'sup_id','')::bigint and staff.role = 'sup' and active;
    if v_sup.id is null or not exists (select 1 from public.staff where id = v_sup.parent_id and staff.role = 'tl') then raise exception 'invalid_sup' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    update public.requests set sup_id = v_sup.id, tl_id = v_sup.parent_id, tl_mode = case when p->>'mode' = 'info' then 'info' else 'confirm' end, tl_ack = false,
      stage = case when p->>'mode' = 'info' then 'sup' else 'tl' end where id = r.id;
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'instr', note); end if;
    if p->>'mode' = 'info' then
      perform public._leg(r.id, v_sup.id, 'sup', mins);
      perform public._notify(public._user_of(v_sup.id), r.id, who || ' حوّل لك ' || t);
      perform public._notify(public._user_of(v_sup.parent_id), r.id, who || ' حوّل ' || t || ' لـ' || v_sup.name || ' (للعلم)');
      perform public._event(r.id, 'حوّله لـ' || v_sup.name || ' (للعلم للتيم ليدر)');
    else
      perform public._leg(r.id, v_sup.parent_id, 'tl', mins);
      perform public._notify(public._user_of(v_sup.parent_id), r.id, who || ' حوّل لك ' || t || ' علشان تأكد');
      perform public._event(r.id, 'حوّله لـ' || v_sup.name || ' (التيم ليدر يأكد الأول)');
    end if;
    perform public._notify(public._users_of('web'), r.id, who || ' حوّل ' || t);
    return;
  end if;

  if a = 'ack' then
    if v_role <> 'tl' or r.tl_id is distinct from me.id or r.tl_mode <> 'info' then raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.requests set tl_ack = true where id = r.id;
    perform public._event(r.id, 'اطّلع (للعلم)');
    perform public._notify(public._users_of('sadmin'), r.id, who || ' اطّلع على ' || t);
    return;
  end if;

  if a = 'confirm' then
    if v_role <> 'tl' or r.stage <> 'tl' or r.tl_id is distinct from me.id then raise exception 'not_allowed' using errcode = '42501'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    update public.requests set tl_ack = true, stage = 'sup' where id = r.id;
    perform public._leg(r.id, r.sup_id, 'sup', mins);
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    perform public._event(r.id, 'أكّد وبعته للمشرف');
    perform public._notify(public._user_of(r.sup_id), r.id, who || ' أكّد وبعت لك ' || t);
    perform public._notify(public._users_of('sadmin'), r.id, who || ' أكّد ' || t);
    return;
  end if;

  if a = 'assign' then
    if v_role <> 'sup' or r.stage <> 'sup' or r.sup_id is distinct from me.id then raise exception 'not_allowed' using errcode = '42501'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    select * into v_sales from public.staff where id = nullif(p->>'sales_id','')::bigint and staff.role in ('junior','senior') and active;
    if v_sales.id is null or not public._is_under(v_sales.id, me.id) then raise exception 'invalid_sales' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    update public.requests set sales_id = v_sales.id, stage = 'sales' where id = r.id;
    perform public._leg(r.id, v_sales.id, v_sales.role, mins);
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    perform public._event(r.id, 'اداه لـ' || v_sales.name);
    perform public._notify(public._user_of(v_sales.id), r.id, who || ' اداك ' || t);
    perform public._notify(public._user_of(r.tl_id), r.id, who || ' ادى ' || t || ' لـ' || v_sales.name);
    return;
  end if;

  if a = 'status' then
    k := p->>'key';
    if public._st_label(k) is null then raise exception 'invalid_status' using errcode = '22023'; end if;
    if not coalesce((v_role in ('junior','senior') and r.stage = 'sales' and r.sales_id = me.id) or (v_role in ('owner','sadmin') and r.via = 'ask' and r.stage <> 'closed'), false) then
      raise exception 'not_allowed' using errcode = '42501'; end if;
    if r.first_at is null then
      update public.requests set first_at = now() where id = r.id;
      if r.via <> 'ask' then perform public._close_legs(r.id); end if;
    end if;
    update public.request_legs set ended_at = now() where request_id = r.id and kind = 's' and ended_at is null;
    update public.requests set st_key = k, st_at = now(), st_due = case when mins is null then null else now() + make_interval(mins => mins) end where id = r.id;
    insert into public.request_legs (request_id, staff_id, role, kind, label, due_at) values (r.id, me.id, v_role, 's', public._st_label(k), case when mins is null then null else now() + make_interval(mins => mins) end);
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'note', note); end if;
    perform public._event(r.id, 'الحالة: ' || public._st_label(k));
    if r.sup_id is not null then perform public._notify(public._user_of(r.sup_id), r.id, who || ' حدّث ' || t || ': ' || public._st_label(k)); end if;
    return;
  end if;

  if a = 'return' then
    if v_role not in ('junior','senior') or r.stage <> 'sales' or r.sales_id is distinct from me.id then raise exception 'not_allowed' using errcode = '42501'; end if;
    v_out := p->>'outcome';
    if public._out_label(v_out) is null then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    if v_out = 'lost' and nullif(btrim(coalesce(p->>'reason','')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
    if nullif(btrim(coalesce(p->>'summary','')), '') is null then raise exception 'summary_required' using errcode = '22023'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    update public.requests set outcome = v_out, outcome_reason = nullif(btrim(coalesce(p->>'reason','')), ''), outcome_summary = btrim(p->>'summary'),
      first_at = coalesce(first_at, now()), stage = 'up_sup' where id = r.id;
    perform public._leg(r.id, r.sup_id, 'sup', mins);
    perform public._event(r.id, 'بعت تحويلة راجعة: ' || public._out_label(v_out));
    perform public._notify(public._user_of(r.sup_id), r.id, who || ' بعت تحويلة راجعة في ' || t || ': ' || public._out_label(v_out));
    return;
  end if;

  if a = 'up' then
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;
      perform public._leg(r.id, r.tl_id, 'tl', mins);
      perform public._event(r.id, 'وافق على التحويلة الراجعة وبعتها للتيم ليدر');
      perform public._notify(public._user_of(r.tl_id), r.id, who || ' بعت لك ' || t || ' (راجع)');
    elsif v_role = 'tl' and r.stage = 'up_tl' and r.tl_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sa', tl_ack = true where id = r.id;
      perform public._leg(r.id, null, 'sadmin', mins);
      perform public._event(r.id, 'وافق وبعتها للسيلز أدمن');
      perform public._notify(public._users_of('sadmin'), r.id, who || ' بعت ' || t || ' (راجع)');
    else raise exception 'not_allowed' using errcode = '42501'; end if;
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'note', note); end if;
    return;
  end if;

  if a = 'down' then
    if note is null then raise exception 'note_required' using errcode = '22023'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'sales', outcome = null, outcome_reason = null, outcome_summary = null where id = r.id;
      perform public._leg(r.id, r.sales_id, (select s.role from public.staff s where s.id = r.sales_id), mins);
      perform public._notify(public._user_of(r.sales_id), r.id, who || ' رجّع لك ' || t || ': ' || left(note, 120));
    elsif v_role = 'tl' and r.stage = 'up_tl' and r.tl_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sup' where id = r.id;
      perform public._leg(r.id, r.sup_id, 'sup', mins);
      perform public._notify(public._user_of(r.sup_id), r.id, who || ' رجّع لك ' || t || ': ' || left(note, 120));
    elsif v_role in ('owner','sadmin') and r.stage = 'up_sa' then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;
      perform public._leg(r.id, r.tl_id, 'tl', mins);
      perform public._notify(public._user_of(r.tl_id), r.id, who || ' رجّع لك ' || t || ': ' || left(note, 120));
    else raise exception 'not_allowed' using errcode = '42501'; end if;
    insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'instr', note);
    perform public._event(r.id, 'رجّعها خطوة لتحت');
    return;
  end if;

  if a = 'close' then
    if v_role not in ('owner','sadmin') or not (r.stage = 'up_sa' or (r.via in ('ask','wa') and r.stage = 'new') or (r.via = 'ask' and r.stage <> 'closed')) then
      raise exception 'not_allowed' using errcode = '42501'; end if;
    v_out := coalesce(nullif(p->>'outcome',''), r.outcome);
    if public._out_label(v_out) is null then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;
    update public.requests set stage = 'closed', closed_at = now(), outcome = v_out, state = 'closed',
      outcome_reason = coalesce(nullif(btrim(coalesce(p->>'reason','')), ''), outcome_reason),
      web_task = (v_out = 'sold' and r.listing_id is not null) where id = r.id;
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'note', note); end if;
    perform public._event(r.id, 'قفل الطلب: ' || public._out_label(v_out));
    perform public._notify(public._user_of(r.tl_id) || public._user_of(r.sup_id) || public._user_of(r.sales_id) || public._users_of('gm'), r.id, who || ' قفل ' || t || ': ' || public._out_label(v_out));
    if v_out = 'sold' and r.listing_id is not null then
      perform public._notify(public._users_of('web'), r.id, 'اتباعت ' || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'القطعة') || '. شيلها من الموقع.');
    end if;
    return;
  end if;

  if a = 'webdone' then
    if v_role not in ('owner','web') then raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.requests set web_task = false where id = r.id;
    perform public._event(r.id, 'شال القطعة من الموقع');
    return;
  end if;

  raise exception 'invalid_action' using errcode = '22023';
end $$;

-- ---------- alerts ----------
create or replace function public.desk_notifications() returns setof jsonb
language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('id', n.id, 'request_id', n.request_id, 'body', n.body, 'at', n.created_at, 'read', n.read_at is not null)
  from public.notifications n where n.user_id = (select auth.uid()) order by n.created_at desc limit 100; $$;
create or replace function public.desk_notifications_read(p_id bigint default null) returns void
language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null and (p_id is null or id = p_id); $$;

-- ---------- permissions ----------
revoke execute on function public._me(), public._role(), public._actor(), public._users_of(text), public._user_of(bigint), public._notify(uuid[], bigint, text),
  public._event(bigint, text), public._leg(bigint, bigint, text, int), public._close_legs(bigint), public._st_label(text), public._out_label(text),
  public._is_under(bigint, bigint), public._req_title(public.requests), public._req_new(), public._req_via(), public._parent_ok(text, bigint), public._new_code(bigint),
  public._can_see(public.requests), public.wa_click(bigint), public.desk_me(), public.desk_staff(), public.staff_add(jsonb), public.staff_update(bigint, jsonb),
  public.staff_new_code(bigint), public.staff_set_avail(boolean), public.desk_requests(), public.desk_request(bigint), public.desk_act(bigint, jsonb),
  public.desk_notifications(), public.desk_notifications_read(bigint) from public, anon, authenticated;
grant execute on function public.wa_click(bigint) to anon, authenticated;
grant execute on function public.desk_me(), public.desk_staff(), public.staff_add(jsonb), public.staff_update(bigint, jsonb), public.staff_new_code(bigint),
  public.staff_set_avail(boolean), public.desk_requests(), public.desk_request(bigint), public.desk_act(bigint, jsonb),
  public.desk_notifications(), public.desk_notifications_read(bigint) to authenticated;
