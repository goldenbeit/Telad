-- النطاق السعري (16/11): a highest price per m² for each zone × allocated / not, and an average set by hand.
--  * Price per m² = total price ÷ area: allocated plots on the area after legalization, others on the original area.
--  * Checked on NEW seller offers only (listings.over_range: null = older plot, not checked; true / false = checked).
--    Over the highest price: a notice to the super admin and the GM (and the owner); the offer goes on as usual.
--  * The super admin, the GM and the owner edit the numbers from the "النطاق السعري" tab.
--  * A checked plot over the range can go to the archive ('archived'): off the site, its open review closes.
--    The owner, GM, super admin, sales admin and web admin can do it.

create table if not exists public.price_ranges (
  zone text not null check (zone in ('القادسية','الأمل')),
  allocated boolean not null,
  max_pm numeric check (max_pm > 0 and max_pm < 10000000),
  avg_pm numeric check (avg_pm > 0 and avg_pm < 10000000),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (zone, allocated)
);
alter table public.price_ranges enable row level security;
insert into public.price_ranges (zone, allocated, max_pm, avg_pm) values
  ('القادسية', false, 3300, null), ('القادسية', true, 5500, 4250), ('الأمل', false, 5750, null), ('الأمل', true, 7750, 6500)
on conflict do nothing;

alter table public.listings add column if not exists over_range boolean;
alter table public.listings drop constraint if exists listings_state_check;
alter table public.listings add constraint listings_state_check check (state in ('pending','approved','rejected','sold','hidden','archived'));

create or replace function public._listing_pm(l public.listings) returns numeric
language sql stable set search_path = ''
as $$ select round(l.price / nullif(case when l.allocated then coalesce(l.area_final, l.area_orig) else coalesce(l.area_orig, l.area_final) end, 0)); $$;

-- check one plot against its range; a notice when it newly goes over
create or replace function public._range_check(p_listing bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare l public.listings; mx numeric; pm numeric; v boolean;
begin
  select * into l from public.listings where id = p_listing;
  if l.id is null then return; end if;
  select max_pm into mx from public.price_ranges where zone = l.zone and allocated = l.allocated;
  pm := public._listing_pm(l); v := coalesce(pm > mx, false);
  update public.listings set over_range = v where id = l.id;
  if v and l.over_range is distinct from true then
    perform public._notify(public._users_of('super') || public._users_of('gm'),
      (select r.id from public.requests r where r.listing_id = l.id and r.via = 'offer' and r.stage <> 'closed' limit 1),
      'القطعة ' || coalesce(l.code, '') || ' عدّت النطاق السعري: سعر المتر ' || to_char(pm, 'FM999,999,999') || ' والأقصى ' || to_char(mx, 'FM999,999,999') || ' ج.م');
    perform public._event(r.id, 'سعر المتر ' || to_char(pm, 'FM999,999,999') || ' عدّى النطاق السعري (الأقصى ' || to_char(mx, 'FM999,999,999') || ')')
      from public.requests r where r.listing_id = l.id and r.via = 'offer' and r.stage <> 'closed';
  end if;
end $$;

create or replace function public.desk_ranges() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public._role() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('zone', g.zone, 'allocated', g.allocated, 'max_pm', g.max_pm, 'avg_pm', g.avg_pm,
      'updated_at', g.updated_at, 'updated_by', g.updated_by,
      'v_avg', (select round(avg(public._listing_pm(l))) from public.listings l where l.state = 'approved' and l.verified and l.zone = g.zone and l.allocated = g.allocated),
      'v_n', (select count(*) from public.listings l where l.state = 'approved' and l.verified and l.zone = g.zone and l.allocated = g.allocated))
    order by g.zone desc, g.allocated desc) from public.price_ranges g), '[]'::jsonb);
end $$;

create or replace function public.desk_range_set(p_zone text, p_allocated boolean, p_max numeric, p_avg numeric) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._can_manage() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_max is not null and not (p_max > 0 and p_max < 10000000) or p_avg is not null and not (p_avg > 0 and p_avg < 10000000) then
    raise exception 'invalid_amount' using errcode = '22023'; end if;
  update public.price_ranges set max_pm = p_max, avg_pm = p_avg, updated_at = now(), updated_by = public._actor()
    where zone = p_zone and allocated = p_allocated;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
end $$;

create or replace function public.listing_archive(p_listing bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); l public.listings; x record;
begin
  if v_role is null or v_role not in ('owner','gm','super','sadmin','web') then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing for update;
  if l.id is null or l.over_range is not true or l.state = 'archived' then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.listings set state = 'archived', reviewed_at = now() where id = l.id;
  for x in select r.id from public.requests r where r.listing_id = l.id and r.via in ('offer','verify') and r.stage <> 'closed' loop
    update public.request_legs set ended_at = now() where request_id = x.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(), web_task = false,
      outcome = case when via = 'verify' then 'dropped' else 'unfit' end, outcome_reason = 'اتحوّل للأرشيف: عدّى النطاق السعري' where id = x.id;
    perform public._event(x.id, 'حوّل القطعة للأرشيف (عدّت النطاق السعري)');
  end loop;
  perform public._notify(public._users_of('super') || public._users_of('gm') || public._users_of('sadmin') || public._users_of('web'), null,
    public._actor() || ' حوّل ' || coalesce(l.code, 'القطعة') || ' للأرشيف (عدّت النطاق السعري)');
end $$;

revoke execute on function public._listing_pm(public.listings) from public, anon;
revoke execute on function public._range_check(bigint) from public, anon, authenticated;
revoke execute on function public.desk_ranges() from public, anon;
revoke execute on function public.desk_range_set(text, boolean, numeric, numeric) from public, anon;
revoke execute on function public.listing_archive(bigint) from public, anon;

create or replace function pg_temp.rep(d text, a text, b text, cnt int) returns text language plpgsql as $f$
declare n int := (length(d) - length(replace(d, a, ''))) / length(a);
begin
  if n <> cnt then raise exception 'patch matched % times (wanted %): %', n, cnt, left(a, 80); end if;
  return replace(d, a, b);
end $f$;

do $m$
declare d text;
begin
  -- new offers get checked
  d := pg_get_functiondef('public.submit_offer'::regproc);
  execute pg_temp.rep(d, $a$  perform public._offer_open(v_id);$a$, $b$  perform public._offer_open(v_id);
  perform public._range_check(v_id);$b$, 1);

  -- an edit re-checks a plot that was checked (a new one)
  d := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure);
  execute pg_temp.rep(d, $a$  perform public._event(r.id, 'صلّح بيانات القطعة')$a$, $b$  if (select over_range from public.listings where id = p_id) is not null then perform public._range_check(p_id); end if;
  perform public._event(r.id, 'صلّح بيانات القطعة')$b$, 1);

  -- publishing again from the archive counts like publishing a new one
  d := pg_get_functiondef('public.admin_set_state(bigint,text)'::regprocedure);
  execute pg_temp.rep(d, $a$p_state = 'approved' and state = 'pending'$a$, $b$p_state = 'approved' and state in ('pending','archived')$b$, 2);

  -- the desk sees the price per m² and the flag
  d := pg_get_functiondef('public.desk_request(bigint)'::regprocedure);
  execute pg_temp.rep(d, $a$'unit', (select jsonb_build_object('code', l.code,$a$,
    $b$'unit', (select jsonb_build_object('pm', public._listing_pm(l), 'over_range', l.over_range, 'allocated', l.allocated) || jsonb_build_object('code', l.code,$b$, 1);
  d := pg_get_functiondef('public.desk_requests()'::regprocedure);
  execute pg_temp.rep(d, $a$'l_paid', l.paid,$a$, $b$'l_paid', l.paid, 'l_over', l.over_range,$b$, 1);
  d := pg_get_functiondef('public.admin_listings()'::regprocedure);
  execute pg_temp.rep(d, $a$'request_count', (select$a$, $b$'pm', public._listing_pm(l), 'request_count', (select$b$, 1);
end $m$;
