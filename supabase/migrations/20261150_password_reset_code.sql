-- "New code" works for activated members too (24/11): the owner, GM or super gives a code, and the member
-- sets a new password with it from the activation screen. Their account, work and notifications stay as they are.
-- A code for an activated member is valid for 24 hours (7 days for a first activation).
create or replace function public.staff_new_code(p_id bigint)
 returns text language plpgsql security definer set search_path to '' as $function$
declare c text; v_uid uuid;
begin
  if not public._can_manage() then raise exception 'not_owner' using errcode = '42501'; end if;
  if public._mgr_blocked((select s.role from public.staff s where s.id = p_id), null) then raise exception 'not_owner' using errcode = '42501'; end if;
  select user_id into v_uid from public.staff where id = p_id;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  if v_uid is not null and exists (select 1 from public.admins a where a.user_id = v_uid) then raise exception 'not_owner' using errcode = '42501'; end if;
  c := public._new_code(p_id);
  if v_uid is not null then update public.staff set code_expires = now() + interval '24 hours' where id = p_id; end if;
  return c;
end $function$;
