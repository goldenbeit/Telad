-- Test mode: the owner (admins table) can act as any team member in the desk, to try every role
-- without their accounts. Only an admin can switch it on; choosing nobody switches it off.
-- Notifications for members who have not activated yet are kept under a fixed id per member,
-- so the bell works while acting as them.

alter table public.admins add column if not exists acting_as bigint references public.staff(id) on delete set null;

create or replace function public._acting() returns bigint
language sql stable security definer set search_path = ''
as $$ select a.acting_as from public.admins a where a.user_id = (select auth.uid()) and a.acting_as is not null limit 1; $$;

-- fixed notification id for a member with no account yet
create or replace function public._staff_uid(p_staff bigint) returns uuid
language sql immutable set search_path = ''
as $$ select md5('telad-staff-' || p_staff)::uuid; $$;

create or replace function public._me() returns public.staff
language sql stable security definer set search_path = ''
as $$ select s.* from public.staff s where s.active and
  case when public._acting() is not null then s.id = public._acting() else s.user_id = (select auth.uid()) end limit 1; $$;

create or replace function public._role() returns text
language sql stable security definer set search_path = ''
as $$ select case when public._acting() is not null then (select s.role from public.staff s where s.id = public._acting() and s.active)
  when public.is_admin() then 'owner'
  else (select s.role from public.staff s where s.user_id = (select auth.uid()) and s.active limit 1) end; $$;

create or replace function public._actor() returns text
language sql stable security definer set search_path = ''
as $$ select case when public._acting() is not null then (select s.name from public.staff s where s.id = public._acting())
  when public.is_admin() then 'الأدمن'
  else coalesce((select s.name from public.staff s where s.user_id = (select auth.uid()) limit 1), '—') end; $$;

create or replace function public._event(p_req bigint, p_body text) returns void
language sql security definer set search_path = ''
as $$ insert into public.request_events (request_id, staff_id, by_owner, body) values (p_req, (public._me()).id, public.is_admin() and public._acting() is null, p_body); $$;

-- whose bell the current viewer reads
create or replace function public._viewer_uid() returns uuid
language sql stable security definer set search_path = ''
as $$ select case when public._acting() is not null then (select coalesce(s.user_id, public._staff_uid(s.id)) from public.staff s where s.id = public._acting())
  else (select auth.uid()) end; $$;

alter table public.notifications drop constraint if exists notifications_user_id_fkey;

create or replace function public._user_of(p_staff bigint) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(coalesce(s.user_id, public._staff_uid(s.id))), '{}') from public.staff s where s.id = p_staff and s.active; $$;

create or replace function public._users_of(p_role text) returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(distinct u), '{}') from (
  select coalesce(s.user_id, public._staff_uid(s.id)) u from public.staff s where s.role = p_role and s.active
  union select a.user_id from public.admins a where p_role in ('sadmin','web','gm')) x; $$;

create or replace function public._notify(p_users uuid[], p_req bigint, p_body text) returns void
language sql security definer set search_path = ''
as $$ insert into public.notifications (user_id, request_id, body)
  select distinct u, p_req, p_body from unnest(p_users) u where u is not null and u is distinct from public._viewer_uid(); $$;

create or replace function public.desk_notifications() returns setof jsonb
language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('id', n.id, 'request_id', n.request_id, 'body', n.body, 'at', n.created_at, 'read', n.read_at is not null)
  from public.notifications n where n.user_id = public._viewer_uid() order by n.created_at desc limit 100; $$;

create or replace function public.desk_notifications_read(p_id bigint default null) returns void
language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now() where user_id = public._viewer_uid() and read_at is null and (p_id is null or id = p_id); $$;

create or replace function public.desk_me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.staff := public._me(); adm boolean := public.is_admin();
begin
  if adm and public._acting() is null then return jsonb_build_object('owner', true, 'role', 'owner', 'name', 'الأدمن', 'id', null, 'can_act', true); end if;
  if s.id is null then return null; end if;
  return jsonb_build_object('owner', false, 'id', s.id, 'name', s.name, 'role', s.role, 'avail', s.avail, 'parent_id', s.parent_id, 'acting', adm, 'can_act', adm);
end $$;

create or replace function public.desk_act_as(p_staff bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_owner' using errcode = '42501'; end if;
  if p_staff is not null and not exists (select 1 from public.staff where id = p_staff and active) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.admins set acting_as = p_staff where user_id = (select auth.uid());
end $$;

revoke execute on function public.desk_act_as(bigint) from public, anon;
grant execute on function public.desk_act_as(bigint) to authenticated;
