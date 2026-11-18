-- Undo a status ticked by mistake (18/11): the salesperson holding the request (or the owner / super admin) can un-tick
-- any status. Its step is removed; if it was the latest one, the step before it becomes the current one again
-- (its deadline comes back as it was). The log keeps a line saying it was undone.

create or replace function public.desk_status_undo(p_id bigint, p_key text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me(); r public.requests; v_label text := public._st_label(p_key);
  g record; k text;
begin
  select * into r from public.requests where id = p_id for update;
  if r.id is null or not public._can_see(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_label is null then raise exception 'invalid_status' using errcode = '22023'; end if;
  if not (r.stage = 'sales' and ((v_role in ('junior','senior') and r.sales_id = me.id) or v_role in ('owner','super'))) then
    raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.request_legs where request_id = r.id and kind = 's' and label = v_label) then
    raise exception 'not_found' using errcode = '22023'; end if;
  delete from public.request_legs where request_id = r.id and kind = 's' and label = v_label;
  -- the latest remaining status becomes the current one again
  select * into g from public.request_legs where request_id = r.id and kind = 's' order by id desc limit 1;
  if g.id is null then
    update public.requests set st_key = null, st_at = null, st_due = case when r.batch is not null then st_due end where id = r.id;
  else
    update public.request_legs set ended_at = null where id = g.id;
    select x into k from unnest(array['call_buyer','call_seller','visit_set','visited','nego','deposit','o_seller','o_data','o_photos','o_price','o_serious',
      'v_seller','v_data','v_photos','v_still','v_price']) x where public._st_label(x) = g.label limit 1;
    update public.requests set st_key = k, st_at = g.started_at, st_due = case when r.batch is not null then st_due else g.due_at end where id = r.id;
  end if;
  perform public._event(r.id, 'لغى الحالة: ' || v_label);
end $$;
revoke execute on function public.desk_status_undo(bigint, text) from public, anon;
