-- Plots from the salespeople's sheet (18/11).
-- Each new plot comes in unpublished and goes straight to its salesperson as a verification request (stage 'sales').
--  * One deadline for the whole task (48 h): statuses don't reset it (requests.batch marks these requests).
--  * Any supervisor sees them and can take the return; any team leader approves. The one who acts is recorded.
--  * Plots may come in with data missing (listings.missing): saved anyway, but "تمام" (sound) and publishing are
--    blocked until the salesperson completes them from "صلّح بيانات القطعة". "مش سليمة" is allowed.
--  * Approving "تمام" publishes the plot (pending -> approved, verified). "مش سليمة" rejects it.
-- The rows themselves (sellers' phones) are imported directly and are not kept in this public repository.

alter table public.requests add column if not exists batch text;
alter table public.listings add column if not exists missing text[];

alter table public.listings alter column price drop not null, alter column paid drop not null, alter column zone drop not null, alter column allocated drop not null;
alter table public.listing_private alter column phone drop not null;
alter table public.listings drop constraint if exists listings_area_present;
alter table public.listings add constraint listings_area_present check (area_orig is not null or area_final is not null or missing is not null);
alter table public.requests drop constraint if exists requests_contact_required;
alter table public.requests add constraint requests_contact_required check (via = 'wa' or (phone is not null and name is not null) or (batch is not null and name is not null));

-- what is still missing on a plot (null when complete)
create or replace function public._listing_missing(p_listing bigint) returns text[]
language sql stable security definer set search_path = ''
as $$ select nullif(array_remove(array[
    case when l.zone is null then 'المنطقة' end,
    case when l.allocated is null or (l.allocated and l.district is null) then 'الحي' end,
    case when l.area_orig is null and l.area_final is null then 'المساحة' end,
    case when l.price is null or l.paid is null then 'السعر' end,
    case when pr.phone is null then 'رقم المعلن' end], null), '{}')
  from public.listings l left join public.listing_private pr on pr.listing_id = l.id where l.id = p_listing; $$;
revoke execute on function public._listing_missing(bigint) from public, anon, authenticated;

-- any supervisor sees the sheet plots (not only the one on the request)
create or replace function public._can_see(r public.requests) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(case public._role()
  when 'owner' then true when 'sadmin' then true when 'gm' then true when 'super' then true
  when 'web' then r.via <> 'ask'
  when 'tl' then r.tl_id = (public._me()).id or (r.via = 'verify' and r.tl_id is null)
  when 'sup' then r.sup_id = (public._me()).id or (r.batch is not null and r.sup_id is null)
  when 'junior' then r.sales_id = (public._me()).id
  when 'senior' then r.sales_id = (public._me()).id
  else false end, false); $$;

create or replace function pg_temp.rep(d text, a text, b text, cnt int) returns text language plpgsql as $f$
declare n int := (length(d) - length(replace(d, a, ''))) / length(a);
begin
  if n <> cnt then raise exception 'patch matched % times (wanted %): %', n, cnt, left(a, 80); end if;
  return replace(d, a, b);
end $f$;

do $m$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
begin
  -- statuses keep the one 48 h deadline
  d := pg_temp.rep(d, $a$      if r.via <> 'ask' then perform public._close_legs(r.id); end if;$a$,
    $b$      if r.via <> 'ask' and r.batch is null then perform public._close_legs(r.id); end if;$b$, 1);
  d := pg_temp.rep(d, $a$    update public.requests set st_key = k, st_at = now(), st_due = case when mins is null then null else now() + make_interval(mins => mins) end where id = r.id;
    insert into public.request_legs (request_id, staff_id, role, kind, label, due_at) values (r.id, me.id, v_role, 's', public._st_label(k), case when mins is null then null else now() + make_interval(mins => mins) end);$a$,
    $b$    update public.requests set st_key = k, st_at = now(), st_due = case when r.batch is not null then (select max(g.due_at) from public.request_legs g where g.request_id = r.id and g.kind = 't' and g.ended_at is null) when mins is null then null else now() + make_interval(mins => mins) end where id = r.id;
    insert into public.request_legs (request_id, staff_id, role, kind, label, due_at) values (r.id, me.id, v_role, 's', public._st_label(k), case when r.batch is not null then (select max(g.due_at) from public.request_legs g where g.request_id = r.id and g.kind = 't' and g.ended_at is null) when mins is null then null else now() + make_interval(mins => mins) end);$b$, 1);

  -- "خلّصت ← تمام" needs complete data; the return goes to every supervisor when none is on the request
  d := pg_temp.rep(d, $a$    v_out := p->>'outcome';
    if public._out_label(v_out) is null then raise exception 'invalid_outcome' using errcode = '22023'; end if;$a$,
    $b$    v_out := p->>'outcome';
    if public._out_label(v_out) is null then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    if v_out = 'sound' and exists (select 1 from public.listings l where l.id = r.listing_id and l.missing is not null) then raise exception 'data_missing' using errcode = '22023'; end if;$b$, 1);
  d := pg_temp.rep(d, $a$    perform public._notify(public._user_of(r.sup_id), r.id, who || ' بعت تحويلة راجعة في ' || t || ': ' || public._out_label(v_out));$a$,
    $b$    perform public._notify(case when r.sup_id is null then public._users_of('sup') else public._user_of(r.sup_id) end, r.id, who || ' بعت تحويلة راجعة في ' || t || ': ' || public._out_label(v_out));$b$, 1);

  -- verification always goes up to a team leader
  d := pg_temp.rep(d, $a$    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id and (r.tl_id is null or r.tl_mode = 'info') then$a$,
    $b$    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id and r.via <> 'verify' and (r.tl_id is null or r.tl_mode = 'info') then$b$, 1);
  -- any supervisor takes a sheet return (and is recorded on it); with no team leader on it, every team leader is told
  d := pg_temp.rep(d, $a$    elsif v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl' where id = r.id;
      perform public._leg(r.id, r.tl_id, 'tl', mins);
      perform public._event(r.id, 'وافق على التحويلة الراجعة وبعتها للتيم ليدر');
      perform public._notify(public._user_of(r.tl_id), r.id, who || ' بعت لك ' || t || ' (راجع)');$a$,
    $b$    elsif v_role = 'sup' and r.stage = 'up_sup' and (r.sup_id = me.id or (r.sup_id is null and r.batch is not null)) then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_tl', sup_id = coalesce(sup_id, me.id) where id = r.id;
      perform public._leg(r.id, r.tl_id, 'tl', mins);
      perform public._event(r.id, 'وافق على التحويلة الراجعة وبعتها للتيم ليدر');
      perform public._notify(case when r.tl_id is null then public._users_of('tl') else public._user_of(r.tl_id) end, r.id, who || ' بعت لك ' || t || ' (راجع)');$b$, 1);
  d := pg_temp.rep(d, $a$    if v_role = 'sup' and r.stage = 'up_sup' and r.sup_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'sales', outcome = null, outcome_reason = null, outcome_summary = null where id = r.id;$a$,
    $b$    if v_role = 'sup' and r.stage = 'up_sup' and (r.sup_id = me.id or (r.sup_id is null and r.batch is not null)) then
      perform public._close_legs(r.id);
      update public.requests set stage = 'sales', outcome = null, outcome_reason = null, outcome_summary = null, sup_id = coalesce(sup_id, me.id) where id = r.id;$b$, 1);
  d := pg_temp.rep(d, $a$    elsif v_role = 'tl' and r.stage = 'up_tl' and r.tl_id = me.id then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sup' where id = r.id;$a$,
    $b$    elsif v_role = 'tl' and r.stage = 'up_tl' and (r.tl_id = me.id or (r.tl_id is null and r.via = 'verify')) then
      perform public._close_legs(r.id);
      update public.requests set stage = 'up_sup', tl_id = coalesce(tl_id, me.id) where id = r.id;$b$, 1);

  -- any team leader approves; "تمام" needs complete data and publishes a sheet plot; "مش سليمة" rejects it
  d := pg_temp.rep(d, $a$    if r.stage <> 'up_tl' or not ((v_role = 'tl' and r.tl_id = me.id) or v_role in ('owner','super')) then raise exception 'not_allowed' using errcode = '42501'; end if;$a$,
    $b$    if r.stage <> 'up_tl' or not ((v_role = 'tl' and (r.tl_id = me.id or r.tl_id is null)) or v_role in ('owner','super')) then raise exception 'not_allowed' using errcode = '42501'; end if;$b$, 1);
  d := pg_temp.rep(d, $a$    if v_out is null or v_out not in ('sound','unsound') then raise exception 'invalid_outcome' using errcode = '22023'; end if;$a$,
    $b$    if v_out is null or v_out not in ('sound','unsound') then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    if v_out = 'sound' and exists (select 1 from public.listings l where l.id = r.listing_id and l.missing is not null) then raise exception 'data_missing' using errcode = '22023'; end if;
    if r.tl_id is null and v_role = 'tl' then update public.requests set tl_id = me.id where id = r.id; end if;$b$, 1);
  d := pg_temp.rep(d, $a$      state = case when verify_hold and state = 'hidden' then 'approved' else state end,
      published_at = case when verify_hold and state = 'hidden' then coalesce(published_at, now()) else published_at end,$a$,
    $b$      state = case when (verify_hold and state = 'hidden') or (state = 'pending' and r.batch is not null) then 'approved' else state end,
      published_at = case when (verify_hold and state = 'hidden') or (state = 'pending' and r.batch is not null) then coalesce(published_at, now()) else published_at end,$b$, 1);
  d := pg_temp.rep(d, $a$    else update public.listings set state = 'hidden', reviewed_at = now() where id = r.listing_id and state = 'approved'; end if;$a$,
    $b$    else update public.listings set state = case when state = 'pending' then 'rejected' else 'hidden' end, reviewed_at = now() where id = r.listing_id and state in ('approved','pending'); end if;$b$, 1);
  execute d;

  -- editing a plot updates what is still missing
  d := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure);
  execute pg_temp.rep(d, $a$  if (select over_range from public.listings where id = p_id) is not null then perform public._range_check(p_id); end if;$a$,
    $b$  update public.listings set missing = public._listing_missing(p_id) where id = p_id and missing is not null;
  if (select over_range from public.listings where id = p_id) is not null then perform public._range_check(p_id); end if;$b$, 1);

  -- the desk sees what is missing
  d := pg_get_functiondef('public.desk_requests()'::regprocedure);
  execute pg_temp.rep(d, $a$jsonb_build_object('id', r.id,$a$,
    $b$jsonb_build_object('batch', r.batch, 'l_missing', (select l2.missing from public.listings l2 where l2.id = r.listing_id)) || jsonb_build_object('id', r.id,$b$, 1);
  d := pg_get_functiondef('public.desk_request(bigint)'::regprocedure);
  execute pg_temp.rep(d, $a$jsonb_build_object('pm', public._listing_pm(l), 'over_range', l.over_range, 'allocated', l.allocated)$a$,
    $b$jsonb_build_object('pm', public._listing_pm(l), 'over_range', l.over_range, 'allocated', l.allocated, 'missing', l.missing)$b$, 1);
end $m$;
