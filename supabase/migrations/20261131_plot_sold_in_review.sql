-- "القطعة اتباعت" (16/11): while verifying an old plot or reviewing a new offer, the salesperson holding it can mark that
-- the seller already sold it. The plot becomes 'sold' (off the site, kept in the desk; "انشرها تاني" brings it back)
-- and the verify / offer request closes with the reason "البائع باعها". The supervisor, team leader, web admin and
-- sales admin get a notice.

create or replace function public.desk_plot_sold(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me(); r public.requests; l public.listings;
begin
  select * into r from public.requests where id = p_id for update;
  if r.id is null or r.via not in ('verify','offer') or r.stage <> 'sales' or r.listing_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not (v_role in ('owner','super') or (v_role in ('junior','senior') and r.sales_id = me.id)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.listings set state = 'sold', reviewed_at = now() where id = r.listing_id and state in ('approved','pending') returning * into l;
  if l.id is null then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;
  update public.requests set stage = 'closed', state = 'closed', closed_at = now(), web_task = false,
    outcome = case when r.via = 'verify' then 'unsound' else 'unfit' end, outcome_reason = 'البائع باعها' where id = r.id;
  perform public._event(r.id, 'علّم إن القطعة اتباعت وشالها من الموقع');
  perform public._notify(public._user_of(r.sup_id) || public._user_of(r.tl_id) || public._users_of('web') || public._users_of('sadmin'), r.id,
    public._actor() || ': القطعة ' || coalesce(l.code, '') || ' اتباعت، واتشالت من الموقع');
end $$;
revoke execute on function public.desk_plot_sold(bigint) from public, anon;
