-- The owner and the GM manage the team: change a member's role, stop/resume, delete, new invite code.
create or replace function public._can_manage() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() or coalesce(public._role() = 'gm', false); $$;

-- a member who is holding an open request can't be deleted, stopped or moved to another role until it is passed on
create or replace function public._has_open(p_id bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.requests r where r.stage <> 'closed' and (
  (r.stage in ('tl','up_tl') and r.tl_id = p_id) or (r.stage in ('sup','up_sup') and r.sup_id = p_id) or (r.stage = 'sales' and r.sales_id = p_id))); $$;

create or replace function public.staff_update(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.staff;
begin
  if not public._can_manage() then raise exception 'not_owner' using errcode = '42501'; end if;
  select * into s from public.staff where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if s.user_id is not null and s.user_id = (select auth.uid()) then raise exception 'not_self' using errcode = '42501'; end if;
  if p ? 'role' and p->>'role' <> s.role then
    if p->>'role' not in ('junior','senior','sup','tl','sadmin','web','gm') then raise exception 'invalid_role' using errcode = '22023'; end if;
    if public._has_open(p_id) then raise exception 'has_open' using errcode = '22023'; end if;
    update public.staff set role = p->>'role', parent_id = null where id = p_id;
  end if;
  if p ? 'active' then
    if (p->>'active')::boolean = false and public._has_open(p_id) then raise exception 'has_open' using errcode = '22023'; end if;
    update public.staff set active = (p->>'active')::boolean where id = p_id;
  end if;
  if p ? 'name' and char_length(btrim(p->>'name')) between 2 and 60 then update public.staff set name = btrim(p->>'name') where id = p_id; end if;
end $$;

create or replace function public.staff_delete(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.staff;
begin
  if not public._can_manage() then raise exception 'not_owner' using errcode = '42501'; end if;
  select * into s from public.staff where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if s.user_id is not null and s.user_id = (select auth.uid()) then raise exception 'not_self' using errcode = '42501'; end if;
  if public._has_open(p_id) then raise exception 'has_open' using errcode = '22023'; end if;
  delete from public.staff where id = p_id;
end $$;

create or replace function public.staff_new_code(p_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._can_manage() then raise exception 'not_owner' using errcode = '42501'; end if;
  if not exists (select 1 from public.staff where id = p_id and user_id is null) then raise exception 'already_active' using errcode = '22023'; end if;
  return public._new_code(p_id);
end $$;

create or replace function public.desk_staff() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r text := public._role(); m boolean := public._can_manage();
begin
  if r is null then raise exception 'not_staff' using errcode = '42501'; end if;
  return query select jsonb_build_object('id', s.id, 'name', s.name, 'role', s.role, 'parent_id', s.parent_id, 'active', s.active, 'avail', s.avail,
      'activated', s.user_id is not null, 'phone', case when m or r = 'sadmin' then s.phone end,
      'code_pending', m and s.user_id is null and s.code_expires > now())
    from public.staff s order by s.id;
end $$;

revoke execute on function public._can_manage(), public._has_open(bigint), public.staff_delete(bigint) from public, anon, authenticated;
revoke execute on function public.staff_update(bigint, jsonb), public.staff_new_code(bigint), public.desk_staff() from public, anon;
grant execute on function public.staff_delete(bigint), public.staff_update(bigint, jsonb), public.staff_new_code(bigint), public.desk_staff() to authenticated;
