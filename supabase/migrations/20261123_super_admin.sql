-- Super admin (سوبر أدمن): between the GM and the sales/web admins.
--  * does everything the sales admin and the web admin do in the desk, and sees every request
--  * moves any request at the team leader / supervisor / sales step to another person of that role (the GM can too),
--    extends a deadline, and alerts any member about a request
--  * reviews and publishes seller listings (not delete)
--  * adds and manages members below him (not the GM or another super admin)

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('junior','senior','sup','tl','sadmin','web','super','gm'));

-- who may run the listings dashboard
create or replace function public._can_listings() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() or coalesce(public._role() = 'super', false); $$;

-- a super admin may not touch the GM or another super admin
create or replace function public._mgr_blocked(p_target text, p_new text) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public._role() = 'super', false) and not public.is_admin()
  and (coalesce(p_target, '') in ('gm','super') or coalesce(p_new, '') in ('gm','super')); $$;

create or replace function public._can_manage() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() or coalesce(public._role() in ('gm','super'), false); $$;

create or replace function public._can_see(r public.requests) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(case public._role()
  when 'owner' then true when 'sadmin' then true when 'gm' then true when 'super' then true
  when 'web' then r.via <> 'ask'
  when 'tl' then r.tl_id = (public._me()).id
  when 'sup' then r.sup_id = (public._me()).id
  when 'junior' then r.sales_id = (public._me()).id
  when 'senior' then r.sales_id = (public._me()).id
  else false end, false); $$;

-- alerts for the sales admin / web admin also reach the super admin
create or replace function public._users_of(p_role text) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(distinct u), '{}') from (
  select coalesce(s.user_id, public._staff_uid(s.id)) u from public.staff s
    where s.active and (s.role = p_role or (p_role in ('sadmin','web') and s.role = 'super'))
  union select a.user_id from public.admins a where p_role in ('sadmin','web','gm')) x; $$;

do $patch$
declare d text; n int; f text;
begin
  -- team management
  d := pg_get_functiondef('public.staff_add(jsonb)'::regprocedure);
  d := replace(d, $a$if v_role not in ('junior','senior','sup','tl','sadmin','web','gm') then$a$, $b$if public._mgr_blocked(null, v_role) then raise exception 'not_owner' using errcode = '42501'; end if;
  if v_role not in ('junior','senior','sup','tl','sadmin','web','super','gm') then$b$);
  if position('_mgr_blocked' in d) = 0 then raise exception 'staff_add patch failed'; end if;
  execute d;

  d := pg_get_functiondef('public.staff_update(bigint,jsonb)'::regprocedure);
  d := replace(d, $a$  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;$a$, $b$  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if public._mgr_blocked(s.role, p->>'role') then raise exception 'not_owner' using errcode = '42501'; end if;$b$);
  d := replace(d, $a$('junior','senior','sup','tl','sadmin','web','gm')$a$, $b$('junior','senior','sup','tl','sadmin','web','super','gm')$b$);
  if position('_mgr_blocked' in d) = 0 or position($a$'super','gm'$a$ in d) = 0 then raise exception 'staff_update patch failed'; end if;
  execute d;

  d := pg_get_functiondef('public.staff_delete(bigint)'::regprocedure);
  d := replace(d, $a$  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;$a$, $b$  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if public._mgr_blocked(s.role, null) then raise exception 'not_owner' using errcode = '42501'; end if;$b$);
  if position('_mgr_blocked' in d) = 0 then raise exception 'staff_delete patch failed'; end if;
  execute d;

  d := pg_get_functiondef('public.staff_new_code(bigint)'::regprocedure);
  d := replace(d, $a$  if not exists (select 1 from public.staff where id = p_id and user_id is null) then$a$, $b$  if public._mgr_blocked((select s.role from public.staff s where s.id = p_id), null) then raise exception 'not_owner' using errcode = '42501'; end if;
  if not exists (select 1 from public.staff where id = p_id and user_id is null) then$b$);
  if position('_mgr_blocked' in d) = 0 then raise exception 'staff_new_code patch failed'; end if;
  execute d;

  -- listings dashboard (review / edit / publish), not delete
  foreach f in array array['admin_listings()','admin_requests()','admin_service_requests()','admin_set_request_state(bigint,text)',
      'admin_set_service_request_state(bigint,text)','admin_set_state(bigint,text)','admin_update_listing(bigint,jsonb)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    n := (length(d) - length(replace(d, 'public.is_admin()', ''))) / length('public.is_admin()');
    if n <> 1 then raise exception '% has % admin checks', f, n; end if;
    execute replace(d, 'public.is_admin()', 'public._can_listings()');
  end loop;

  -- desk: the super admin can do what the sales admin and the web admin do
  d := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  d := replace(d, $a$'owner','sadmin'$a$, $b$'owner','super','sadmin'$b$);
  d := replace(d, $a$('owner','web')$a$, $b$('owner','super','web')$b$);
  -- and step in: move, extend, alert
  n := (length(d) - length(replace(d, $a$  if a = 'webdone' then$a$, ''))) / length($a$  if a = 'webdone' then$a$);
  if n <> 1 then raise exception 'desk_act patch matched % times', n; end if;
  d := replace(d, $a$  if a = 'webdone' then$a$, $b$  if a = 'move' then
    if v_role not in ('owner','super','gm') then raise exception 'not_allowed' using errcode = '42501'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    select * into v_sales from public.staff where id = nullif(p->>'to','')::bigint and active;
    if v_sales.id is null then raise exception 'invalid_target' using errcode = '22023'; end if;
    if r.stage in ('tl','up_tl') then
      if v_sales.role <> 'tl' or v_sales.id = r.tl_id then raise exception 'invalid_target' using errcode = '22023'; end if;
      k := coalesce((select s.name from public.staff s where s.id = r.tl_id), '—');
      perform public._close_legs(r.id);
      update public.requests set tl_id = v_sales.id where id = r.id;
      perform public._leg(r.id, v_sales.id, 'tl', mins);
      perform public._notify(public._user_of(r.tl_id), r.id, who || ' سحب ' || t || ' منك وحوّله لـ' || v_sales.name);
    elsif r.stage in ('sup','up_sup') then
      if v_sales.role <> 'sup' or v_sales.id = r.sup_id then raise exception 'invalid_target' using errcode = '22023'; end if;
      k := coalesce((select s.name from public.staff s where s.id = r.sup_id), '—');
      perform public._close_legs(r.id);
      update public.requests set sup_id = v_sales.id where id = r.id;
      perform public._leg(r.id, v_sales.id, 'sup', mins);
      perform public._notify(public._user_of(r.sup_id), r.id, who || ' سحب ' || t || ' منك وحوّله لـ' || v_sales.name);
    elsif r.stage = 'sales' then
      if v_sales.role not in ('junior','senior') or v_sales.id = r.sales_id then raise exception 'invalid_target' using errcode = '22023'; end if;
      k := coalesce((select s.name from public.staff s where s.id = r.sales_id), '—');
      perform public._close_legs(r.id);
      update public.requests set sales_id = v_sales.id, st_due = now() + make_interval(mins => mins) where id = r.id;
      perform public._leg(r.id, v_sales.id, v_sales.role, mins);
      perform public._notify(public._user_of(r.sales_id), r.id, who || ' سحب ' || t || ' منك وحوّله لـ' || v_sales.name);
    else raise exception 'not_allowed' using errcode = '42501'; end if;
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'instr', note); end if;
    perform public._event(r.id, 'سحبه من ' || k || ' وحوّله لـ' || v_sales.name);
    perform public._notify(public._user_of(v_sales.id), r.id, who || ' حوّل لك ' || t);
    return;
  end if;

  if a = 'extend' then
    if v_role not in ('owner','super') or r.stage = 'closed' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    update public.request_legs set due_at = now() + make_interval(mins => mins) where request_id = r.id and kind = 't' and ended_at is null;
    if r.stage = 'sales' and r.st_due is not null then update public.requests set st_due = now() + make_interval(mins => mins) where id = r.id; end if;
    perform public._event(r.id, 'مدّ المهلة لحد ' || to_char((now() + make_interval(mins => mins)) at time zone 'Africa/Cairo', 'DD/MM HH24:MI') || coalesce(': ' || left(note, 200), ''));
    perform public._notify(case r.stage when 'new' then public._users_of('sadmin') when 'up_sa' then public._users_of('sadmin') when 'tl' then public._user_of(r.tl_id)
      when 'up_tl' then public._user_of(r.tl_id) when 'sup' then public._user_of(r.sup_id) when 'up_sup' then public._user_of(r.sup_id) when 'sales' then public._user_of(r.sales_id) else '{}' end,
      r.id, who || ' مدّ مهلتك في ' || t);
    return;
  end if;

  if a = 'ping' then
    if v_role not in ('owner','super') then raise exception 'not_allowed' using errcode = '42501'; end if;
    if note is null then raise exception 'note_required' using errcode = '22023'; end if;
    select * into v_sales from public.staff where id = nullif(p->>'to','')::bigint and active;
    if v_sales.id is null then raise exception 'invalid_target' using errcode = '22023'; end if;
    perform public._notify(public._user_of(v_sales.id), r.id, who || ' بينبّهك على ' || t || ': ' || left(note, 160));
    perform public._event(r.id, 'نبّه ' || v_sales.name || ': ' || left(note, 200));
    return;
  end if;

  if a = 'webdone' then$b$);
  execute d;
end $patch$;

-- the super admin can open allocation letters while reviewing listings
drop policy if exists "admins read allocation letters" on storage.objects;
create policy "admins read allocation letters" on storage.objects for select
  using (bucket_id = 'allocation-letters' and public._can_listings());
