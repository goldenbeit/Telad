-- Removing and deleting (اتفقنا 14/11):
--  1) "شيله من المسار" (desk_act a = 'drop'): the sales admin, web admin, super admin or the owner cancels a request
--     or an offer at any step, with a reason. It closes as 'dropped' and does not count as a cancelled sale.
--  2) desk_delete: final delete of a request / offer, for the owner and the super admin only (the UI confirms first).
--     The super admin can also delete listings for good from the listings dashboard now.
--  3) Removing a published plot from the site: the team leader and above ask with a reason; the web admin or the
--     sales admin (or super / owner) approves. The listing becomes 'hidden' (not deleted) and can be put back.

alter table public.requests drop constraint if exists requests_outcome_check;
alter table public.requests add constraint requests_outcome_check check (outcome in ('sold','deposit','follow','lost','ready','unfit','dropped'));

create or replace function public._out_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'sold' then 'اتباع' when 'deposit' then 'اتدفع عربون' when 'follow' then 'محتاج متابعة' when 'lost' then 'اتقفل من غير بيع'
  when 'ready' then 'جاهز للنشر' when 'unfit' then 'مش مناسب' when 'dropped' then 'اتشال من المسار' end; $$;

-- 1) drop from the flow
do $m$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure); n int;
begin
  n := (length(d) - length(replace(d, $a$  if a = 'late' then$a$, ''))) / length($a$  if a = 'late' then$a$);
  if n <> 1 then raise exception 'desk_act patch matched % times', n; end if;
  execute replace(d, $a$  if a = 'late' then$a$, $b$  if a = 'drop' then
    if v_role not in ('owner','super','sadmin','web') or r.stage = 'closed' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if note is null then raise exception 'note_required' using errcode = '22023'; end if;
    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(), outcome = 'dropped', outcome_reason = left(note, 200), web_task = false where id = r.id;
    perform public._event(r.id, 'شاله من المسار: ' || left(note, 200));
    perform public._notify(public._user_of(r.tl_id) || public._user_of(r.sup_id) || public._user_of(r.sales_id) || public._users_of('sadmin') || public._users_of('web'), r.id,
      who || ' شال ' || t || ' من المسار: ' || left(note, 120));
    return;
  end if;

  if a = 'late' then$b$);
end $m$;

-- 2) final delete
create or replace function public.desk_delete(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or coalesce(public._role() = 'super', false)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.requests where id = p_id;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
end $$;
revoke execute on function public.desk_delete(bigint) from public, anon;

do $m$
declare d text := pg_get_functiondef('public.admin_delete_listing(bigint)'::regprocedure); n int;
begin
  n := (length(d) - length(replace(d, 'public.is_admin()', ''))) / length('public.is_admin()');
  if n <> 1 then raise exception 'admin_delete_listing patch matched % times', n; end if;
  execute replace(d, 'public.is_admin()', 'public._can_listings()');
end $m$;

-- 3) removing a published plot from the site
create table if not exists public.listing_removals (
  id bigserial primary key,
  listing_id bigint not null references public.listings(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  asked_by bigint references public.staff(id) on delete set null,
  asked_owner boolean not null default false,
  asked_at timestamptz not null default now(),
  state text not null default 'pending' check (state in ('pending','approved','rejected','restored')),
  decided_by bigint references public.staff(id) on delete set null,
  decided_owner boolean not null default false,
  decided_at timestamptz,
  note text check (char_length(note) <= 500),
  restored_at timestamptz
);
alter table public.listing_removals enable row level security;
create unique index if not exists listing_removals_one_pending on public.listing_removals (listing_id) where state = 'pending';

create or replace function public._removal_asker(x public.listing_removals) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select case when x.asked_by is not null then public._user_of(x.asked_by)
  else coalesce((select array_agg(a.user_id) from public.admins a), '{}') end; $$;
revoke execute on function public._removal_asker(public.listing_removals) from public, anon, authenticated;

create or replace function public.listing_remove_ask(p_listing bigint, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me(); l public.listings; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_role is null or v_role not in ('owner','super','gm','sadmin','web','tl') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_reason is null then raise exception 'note_required' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 then raise exception 'note_too_long' using errcode = '22023'; end if;
  select * into l from public.listings where id = p_listing;
  if l.id is null or l.state <> 'approved' then raise exception 'listing_not_found' using errcode = '22023'; end if;
  if v_role = 'tl' and not exists (select 1 from public.requests r where r.listing_id = p_listing and public._can_see(r)) then
    raise exception 'not_allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.listing_removals x where x.listing_id = p_listing and x.state = 'pending') then
    raise exception 'already_asked' using errcode = '22023'; end if;
  insert into public.listing_removals (listing_id, reason, asked_by, asked_owner) values (p_listing, v_reason, me.id, v_role = 'owner');
  perform public._notify(public._users_of('sadmin') || public._users_of('web'), null,
    public._actor() || ' طالب يشيل ' || coalesce(l.code, 'قطعة') || ' من الموقع: ' || left(v_reason, 120));
end $$;

create or replace function public.listing_remove_decide(p_id bigint, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me(); x public.listing_removals; l public.listings; q record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_role is null or v_role not in ('owner','super','sadmin','web') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(coalesce(v_note, '')) > 500 then raise exception 'note_too_long' using errcode = '22023'; end if;
  select * into x from public.listing_removals where id = p_id and state = 'pending' for update;
  if x.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  select * into l from public.listings where id = x.listing_id;
  if p_ok then
    update public.listings set state = 'hidden', reviewed_at = now() where id = x.listing_id and state = 'approved';
    if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
    update public.listing_removals set state = 'approved', decided_by = me.id, decided_owner = v_role = 'owner', decided_at = now(), note = v_note where id = x.id;
    for q in select r.* from public.requests r where r.listing_id = x.listing_id and r.stage <> 'closed' and r.via <> 'offer' loop
      perform public._event(q.id, 'القطعة اتشالت من الموقع: ' || left(x.reason, 200));
      perform public._notify(public._user_of(q.tl_id) || public._user_of(q.sup_id) || public._user_of(q.sales_id), q.id,
        'القطعة ' || coalesce(l.code, '') || ' اتشالت من الموقع، وطلبك عليها لسه مفتوح: ' || left(x.reason, 120));
    end loop;
    perform public._notify(public._removal_asker(x), null, public._actor() || ' وافق وشال ' || coalesce(l.code, 'القطعة') || ' من الموقع');
  else
    update public.listing_removals set state = 'rejected', decided_by = me.id, decided_owner = v_role = 'owner', decided_at = now(), note = v_note where id = x.id;
    perform public._notify(public._removal_asker(x), null, public._actor() || ' مش موافق يشيل ' || coalesce(l.code, 'القطعة') || coalesce(': ' || left(v_note, 120), ''));
  end if;
end $$;

create or replace function public.listing_restore(p_listing bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); l public.listings;
begin
  if v_role is null or v_role not in ('owner','super','sadmin','web') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.listing_removals x where x.listing_id = p_listing and x.state = 'approved') then raise exception 'not_found' using errcode = '22023'; end if;
  update public.listings set state = 'approved', reviewed_at = now() where id = p_listing and state = 'hidden' returning * into l;
  if l.id is null then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.listing_removals set state = 'restored', restored_at = now() where listing_id = p_listing and state = 'approved';
  perform public._notify(public._users_of('sadmin') || public._users_of('web'), null, public._actor() || ' رجّع ' || coalesce(l.code, 'القطعة') || ' للموقع');
end $$;

create or replace function public.desk_removals() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me();
begin
  if v_role is null or v_role not in ('owner','super','gm','sadmin','web','tl') then return; end if;
  return query select jsonb_build_object('id', x.id, 'listing_id', x.listing_id, 'state', x.state, 'reason', x.reason, 'note', x.note,
      'asked_at', x.asked_at, 'decided_at', x.decided_at, 'restored_at', x.restored_at,
      'asked', case when x.asked_owner then 'الأدمن' else (select s.name from public.staff s where s.id = x.asked_by) end,
      'decided', case when x.decided_owner then 'الأدمن' else (select s.name from public.staff s where s.id = x.decided_by) end,
      'code', l.code, 'l_state', l.state, 'zone', l.zone, 'district', l.district, 'area', coalesce(l.area_final, l.area_orig), 'paid', l.paid,
      'open', (select count(*) from public.requests r where r.listing_id = x.listing_id and r.stage <> 'closed' and r.via <> 'offer'))
    from public.listing_removals x join public.listings l on l.id = x.listing_id
    where v_role <> 'tl' or x.asked_by = me.id
    order by x.asked_at desc;
end $$;

revoke execute on function public.listing_remove_ask(bigint, text) from public, anon;
revoke execute on function public.listing_remove_decide(bigint, boolean, text) from public, anon;
revoke execute on function public.listing_restore(bigint) from public, anon;
revoke execute on function public.desk_removals() from public, anon;
