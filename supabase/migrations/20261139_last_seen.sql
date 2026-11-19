-- Who is in the dashboard (19/11): every open dashboard says "I'm here" each minute (desk_seen), and the mirror shows
-- each member "أونلاين" or their last time in. Each person only sees the roles under them (decided 19/11):
-- owner: all · GM: all members · super: sales admin, web admin and below · sales admin / web admin: each other and below ·
-- team leader: supervisors and sales · supervisor: sales · sales: nobody. Acting as someone (test mode) records nothing.

alter table public.staff add column if not exists last_seen timestamptz;

create or replace function public.desk_seen() returns void language sql security definer set search_path = ''
as $$ update public.staff set last_seen = now() where user_id = (select auth.uid()) and active and public._acting() is null $$;
revoke execute on function public.desk_seen() from public, anon;
grant execute on function public.desk_seen() to authenticated;

create or replace function public._seen_ok(p_target text) returns boolean language sql stable security definer set search_path = ''
as $$
  select case public._role()
    when 'owner' then true
    when 'gm' then true
    when 'super' then p_target in ('sadmin','web','tl','sup','senior','junior')
    when 'sadmin' then p_target in ('sadmin','web','tl','sup','senior','junior')
    when 'web' then p_target in ('sadmin','web','tl','sup','senior','junior')
    when 'tl' then p_target in ('sup','senior','junior')
    when 'sup' then p_target in ('senior','junior')
    else false end
$$;
revoke execute on function public._seen_ok(text) from public, anon, authenticated;

create or replace function public.desk_staff() returns setof jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare r text := public._role(); m boolean := public._can_manage();
begin
  if r is null then raise exception 'not_staff' using errcode = '42501'; end if;
  return query select jsonb_build_object('id', s.id, 'name', s.name, 'role', s.role, 'parent_id', s.parent_id, 'active', s.active, 'avail', s.avail,
      'activated', s.user_id is not null, 'phone', case when m or r = 'sadmin' then s.phone end,
      'code_pending', m and s.user_id is null and s.code_expires > now(),
      'seen_ok', public._seen_ok(s.role), 'seen', case when public._seen_ok(s.role) then s.last_seen end)
    from public.staff s order by s.id;
end $function$;
