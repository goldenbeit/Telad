-- The manager ("تابع لمين") is optional for every role. When it is missing:
-- a supervisor without a team leader gets requests directly (no TL step), any supervisor can pick a salesperson with no manager,
-- and the return chain skips the missing team leader.
create or replace function public._parent_ok(p_role text, p_parent bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select case
  when p_role = 'gm' then p_parent is null
  when p_parent is null then true
  when p_role in ('sadmin','web') then exists (select 1 from public.staff where id = p_parent and role = 'gm')
  else exists (select 1 from public.staff where id = p_parent and role = case p_role when 'junior' then 'senior' when 'senior' then 'sup' when 'sup' then 'tl' when 'tl' then 'sadmin' end) end; $$;
revoke execute on function public._parent_ok(text, bigint) from public, anon, authenticated;

do $do$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure); prev text;
  pairs text[][] := array[
   [$s$if v_sup.id is null or not exists (select 1 from public.staff where id = v_sup.parent_id and staff.role = 'tl') then raise exception 'invalid_sup' using errcode = '22023'; end if;$s$,
    $s$if v_sup.id is null then raise exception 'invalid_sup' using errcode = '22023'; end if;
    if not exists (select 1 from public.staff where id = v_sup.parent_id and staff.role = 'tl') then v_sup.parent_id := null; p := p || '{"mode":"info"}'; end if;$s$],
   [$s$      perform public._notify(public._user_of(v_sup.parent_id), r.id, who || ' حوّل ' || t || ' لـ' || v_sup.name || ' (للعلم)');
      perform public._event(r.id, 'حوّله لـ' || v_sup.name || ' (للعلم للتيم ليدر)');$s$,
    $s$      if v_sup.parent_id is not null then perform public._notify(public._user_of(v_sup.parent_id), r.id, who || ' حوّل ' || t || ' لـ' || v_sup.name || ' (للعلم)'); end if;
      perform public._event(r.id, 'حوّله لـ' || v_sup.name || case when v_sup.parent_id is null then '' else ' (للعلم للتيم ليدر)' end);$s$],
   [$s$if v_sales.id is null or not public._is_under(v_sales.id, me.id) then$s$,
    $s$if v_sales.id is null or not (v_sales.parent_id is null or public._is_under(v_sales.id, me.id)) then$s$],
   [$s$    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;$s$,
    $s$    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id and r.tl_id is null then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sa' where id = r.id;
      perform public._leg(r.id, null, 'sadmin', mins);
      perform public._event(r.id, 'وافق على التحويلة الراجعة وبعتها للسيلز أدمن');
      perform public._notify(public._users_of('sadmin'), r.id, who || ' بعت ' || t || ' (راجع)');
    elsif v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;$s$],
   [$s$    elsif v_role in ('owner','sadmin') and r.stage = 'up_sa' then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;$s$,
    $s$    elsif v_role in ('owner','sadmin') and r.stage = 'up_sa' and r.tl_id is null then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sup' where id = r.id;
      perform public._leg(r.id, r.sup_id, 'sup', mins);
      perform public._notify(public._user_of(r.sup_id), r.id, who || ' رجّع لك ' || t || ': ' || left(note, 120));
    elsif v_role in ('owner','sadmin') and r.stage = 'up_sa' then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;$s$]];
begin
  for i in 1..array_length(pairs, 1) loop
    prev := d; d := replace(d, pairs[i][1], pairs[i][2]);
    if d = prev then raise exception 'patch % did not apply', i; end if;
  end loop;
  execute d;
end $do$;
