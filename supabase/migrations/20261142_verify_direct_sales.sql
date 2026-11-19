-- Verification (19/11): the team leader can give plots straight to a salesperson, like buyer requests (15/11).
-- A supervisor is still chosen: when the salesperson presses "خلّصت" the plot comes back to that supervisor first.
drop function if exists public.desk_verify_assign(bigint[], bigint, integer, text);
create or replace function public.desk_verify_assign(p_ids bigint[], p_sup bigint, p_mins integer, p_note text, p_sales bigint default null)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_role text := public._role(); me public.staff := public._me(); v_sup public.staff; v_sales public.staff; r public.requests; n int := 0; last_id bigint;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_role is distinct from 'tl' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_mins is null or p_mins < 5 or p_mins > 10080 then raise exception 'mins_required' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  select * into v_sup from public.staff where id = p_sup and role = 'sup' and active;
  if v_sup.id is null then raise exception 'invalid_sup' using errcode = '22023'; end if;
  if p_sales is not null then
    select * into v_sales from public.staff where id = p_sales and role in ('junior','senior') and active;
    if v_sales.id is null then raise exception 'invalid_sales' using errcode = '22023'; end if;
  end if;
  for r in select * from public.requests where id = any(p_ids) and via = 'verify' and stage = 'tl' and (tl_id is null or tl_id = me.id) order by id for update loop
    perform public._close_legs(r.id);
    if v_sales.id is null then
      update public.requests set tl_id = me.id, tl_ack = true, sup_id = v_sup.id, stage = 'sup' where id = r.id;
      perform public._leg(r.id, v_sup.id, 'sup', p_mins);
      perform public._event(r.id, 'وزّعه على ' || v_sup.name);
    else
      update public.requests set tl_id = me.id, tl_ack = true, sup_id = v_sup.id, sales_id = v_sales.id, stage = 'sales' where id = r.id;
      perform public._leg(r.id, v_sales.id, v_sales.role, p_mins);
      perform public._event(r.id, 'اداه لـ' || v_sales.name || ' على طول (والرجوع على ' || v_sup.name || ')');
    end if;
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    n := n + 1; last_id := r.id;
  end loop;
  if n = 0 then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_sales.id is null then
    perform public._notify(public._user_of(v_sup.id), case when n = 1 then last_id end,
      public._actor() || ' بعت لك ' || case when n = 1 then 'قطعة' else n || ' قطع' end || ' للتوثيق');
  else
    perform public._notify(public._user_of(v_sales.id), case when n = 1 then last_id end,
      public._actor() || ' اداك ' || case when n = 1 then 'قطعة' else n || ' قطع' end || ' للتوثيق');
    perform public._notify(public._user_of(v_sup.id), case when n = 1 then last_id end,
      public._actor() || ' ادى ' || case when n = 1 then 'قطعة توثيق' else n || ' قطع توثيق' end || ' لـ' || v_sales.name || ' على طول، والرجوع عليك');
  end if;
  return n;
end $function$;
revoke execute on function public.desk_verify_assign(bigint[], bigint, integer, text, bigint) from public, anon;
grant execute on function public.desk_verify_assign(bigint[], bigint, integer, text, bigint) to authenticated;
