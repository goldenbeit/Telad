-- The price range by area (decided 20–22/11, replaces the per-m² range of 16/11).
-- For every zone × allocated × legalized area: the lowest and highest amount the owner asks (المطلوب دفعه), in EGP.
-- Allocated plots use their area after legalization; unallocated ones the area the authority's table gives their
-- original area. Allocated plots inside the range get a level by thirds of it: عادية / سوبر / سوبر سوبريم.
-- A plot over the highest amount (or with an area the table doesn't have) never goes on the site by itself: when it
-- would be published it is hidden and waits in "مراجعة السعر" for the team leader or anyone above (up to the GM and the
-- owner), who either publishes it as a "قنبلة" (exceptional: high and very distinctive; the mark shows in the dashboard
-- only) or archives it. The levels and the mark are dashboard-only; the site shows nothing of this.

create table if not exists public.price_bands (
  id serial primary key, zone text not null, allocated boolean not null, area int not null,
  orig_upto int,               -- only for الأمل غير مخصص 209: by the original area (up to 175 م² / above)
  min_paid numeric, max_paid numeric not null);
create unique index if not exists price_bands_key on public.price_bands (zone, allocated, area, coalesce(orig_upto, 0));
alter table public.price_bands enable row level security;

insert into public.price_bands (zone, allocated, area, orig_upto, min_paid, max_paid) values
  ('القادسية', true, 209, null, 700000, 950000), ('القادسية', true, 276, null, 1150000, 1400000), ('القادسية', true, 350, null, 1350000, 1750000),
  ('القادسية', true, 400, null, 1400000, 1800000), ('القادسية', true, 450, null, 1750000, 2250000), ('القادسية', true, 500, null, 1700000, 3000000),
  ('القادسية', false, 209, null, 560000, 670000), ('القادسية', false, 276, null, 900000, 1050000), ('القادسية', false, 350, null, null, 1000000),
  ('القادسية', false, 400, null, null, 1200000), ('القادسية', false, 450, null, 1250000, 1300000), ('القادسية', false, 500, null, 1450000, 1550000),
  ('الأمل', true, 209, null, 1000000, 1400000), ('الأمل', true, 276, null, 1600000, 2300000), ('الأمل', true, 350, null, 1650000, 2000000),
  ('الأمل', true, 400, null, 2000000, 2300000), ('الأمل', true, 450, null, 2300000, 2600000), ('الأمل', true, 500, null, 2600000, 3500000),
  ('الأمل', false, 209, 175, null, 750000), ('الأمل', false, 209, null, null, 800000), ('الأمل', false, 276, null, 1100000, 1200000),
  ('الأمل', false, 350, null, 1200000, 1350000), ('الأمل', false, 400, null, 1300000, 1450000), ('الأمل', false, 450, null, 1450000, 1550000),
  ('الأمل', false, 500, null, 1700000, 1850000)
on conflict do nothing;

alter table public.listings add column if not exists band_level text check (band_level in ('normal','super','supreme','bomb'));
alter table public.listings add column if not exists price_hold boolean not null default false;

-- the legalized area the table is keyed on
create or replace function public._band_area(l public.listings) returns int language sql immutable set search_path = ''
as $$
  select case when l.allocated then case when l.area_final in (209, 276, 350, 400, 450, 500) then l.area_final::int end
    when l.area_orig is null then null
    when l.area_orig < 276 then 209 when l.area_orig < 375 then 276 when l.area_orig < 475 then 350
    when l.area_orig < 525 then 400 when l.area_orig < 600 then 450 when l.area_orig <= 750 then 500 end
$$;

create or replace function public._band_of(l public.listings) returns public.price_bands language sql stable security definer set search_path = ''
as $$
  select b.* from public.price_bands b
  where b.zone = l.zone and b.allocated = l.allocated and b.area = public._band_area(l)
    and (b.orig_upto is null or l.area_orig <= b.orig_upto)
  order by b.orig_upto nulls last limit 1
$$;
revoke execute on function public._band_of(public.listings) from public, anon, authenticated;

-- level, "over the range" mark, and the hold when it would be published
create or replace function public._listings_band() returns trigger language plpgsql security definer set search_path = '' as $$
declare b public.price_bands; checkable boolean; over boolean; moved boolean; publish boolean;
begin
  moved := tg_op = 'INSERT' or new.paid is distinct from old.paid or new.zone is distinct from old.zone
    or new.allocated is distinct from old.allocated or new.area_final is distinct from old.area_final or new.area_orig is distinct from old.area_orig;
  -- a "قنبلة" stays one until its price or area changes
  if new.band_level = 'bomb' and not (tg_op = 'UPDATE' and old.band_level = 'bomb' and moved) then
    new.over_range := false; new.price_hold := false; return new;
  end if;
  checkable := new.paid is not null and new.zone is not null and new.allocated is not null;
  b := public._band_of(new);
  over := checkable and (b.id is null or new.paid > b.max_paid);
  new.band_level := case when not checkable or b.id is null or new.paid > b.max_paid then null
    when not new.allocated or b.min_paid is null or b.max_paid <= b.min_paid or new.paid < b.min_paid then 'normal'
    when new.paid < b.min_paid + (b.max_paid - b.min_paid) / 3 then 'normal'
    when new.paid < b.min_paid + 2 * (b.max_paid - b.min_paid) / 3 then 'super'
    else 'supreme' end;
  new.over_range := over;
  publish := new.state = 'approved' and (tg_op = 'INSERT' or old.state is distinct from 'approved' or moved);
  if over and publish then
    new.state := 'hidden'; new.price_hold := true;
    perform public._notify(public._users_of('tl') || public._users_of('sadmin') || public._users_of('web') || public._users_of('gm'), null,
      'مراجعة السعر: ' || coalesce(new.code, 'قطعة') || ' ' || case when b.id is null then 'مساحتها مش في جدول النطاق السعري'
        else 'المطلوب دفعه ' || to_char(new.paid, 'FM999,999,999') || ' فوق الحد الأقصى ' || to_char(b.max_paid, 'FM999,999,999') end
      || '. اتشالت من الموقع لحد القرار: قنبلة أو أرشيف.');
  elsif new.state <> 'hidden' then
    new.price_hold := false;
  end if;
  return new;
end $$;
revoke execute on function public._listings_band() from public, anon, authenticated;
drop trigger if exists listings_band on public.listings;
create trigger listings_band before insert or update on public.listings for each row execute function public._listings_band();

-- the old per-m² check is replaced by the trigger above (it used to notify on its own)
create or replace function public._range_check(p_listing bigint) returns void language plpgsql security definer set search_path = ''
as $$ begin return; end $$;

-- ---------- the review ----------
create or replace function public._can_price_review() returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public._role() in ('owner','gm','super','sadmin','web','tl'), false) $$;
revoke execute on function public._can_price_review() from public, anon, authenticated;

create or replace function public.desk_price_reviews() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'code', l.code, 'zone', l.zone, 'district', l.district, 'allocated', l.allocated,
      'area', public._band_area(l), 'area_orig', l.area_orig, 'area_final', l.area_final, 'paid', l.paid, 'price', l.price,
      'min', b.min_paid, 'max', b.max_paid, 'verified', l.verified, 'photo_path', l.photo_path, 'description', l.description,
      'requests', (select count(*) from public.requests r where r.listing_id = l.id), 'at', l.touched_at) order by l.touched_at desc)
    from public.listings l left join lateral (select * from public._band_of(l)) b on true
    where l.price_hold), '[]'::jsonb);
end $$;
revoke execute on function public.desk_price_reviews() from public, anon;
grant execute on function public.desk_price_reviews() to authenticated;

create or replace function public.price_review_decide(p_listing bigint, p_choice text) returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_choice not in ('bomb','archive') then raise exception 'invalid_choice' using errcode = '22023'; end if;
  select * into l from public.listings where id = p_listing for update;
  if l.id is null or not l.price_hold then raise exception 'listing_not_found' using errcode = '22023'; end if;
  if p_choice = 'bomb' then
    update public.listings set band_level = 'bomb', price_hold = false, over_range = false, state = 'approved', reviewed_at = now(),
      published_at = coalesce(published_at, now()) where id = l.id;
  else
    update public.listings set price_hold = false, state = 'archived', reviewed_at = now() where id = l.id;
  end if;
  perform public._notify(public._users_of('tl') || public._users_of('sadmin') || public._users_of('web') || public._users_of('gm'), null,
    public._actor() || case when p_choice = 'bomb' then ' اعتبر ' || coalesce(l.code, 'القطعة') || ' قنبلة ونشرها'
      else ' حوّل ' || coalesce(l.code, 'القطعة') || ' للأرشيف (فوق النطاق السعري)' end);
end $$;
revoke execute on function public.price_review_decide(bigint, text) from public, anon;
grant execute on function public.price_review_decide(bigint, text) to authenticated;

-- ---------- the table in the dashboard ----------
create or replace function public.desk_bands() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public._role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'zone', zone, 'allocated', allocated, 'area', area, 'orig_upto', orig_upto,
    'min', min_paid, 'max', max_paid) order by zone desc, allocated desc, area, orig_upto nulls last) from public.price_bands), '[]'::jsonb);
end $$;
revoke execute on function public.desk_bands() from public, anon;
grant execute on function public.desk_bands() to authenticated;

-- owner / GM / super admin edit a row; levels and marks are worked out again (nothing is hidden by an edit)
create or replace function public.desk_band_set(p_id int, p_min numeric, p_max numeric) returns void language plpgsql security definer set search_path = '' as $$
declare b public.price_bands;
begin
  if not public._can_manage() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_max is null or p_max <= 0 or (p_min is not null and (p_min < 0 or p_min >= p_max)) then raise exception 'invalid_range' using errcode = '22023'; end if;
  update public.price_bands set min_paid = p_min, max_paid = p_max where id = p_id returning * into b;
  if b.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  update public.listings set band_level = band_level where zone = b.zone and allocated = b.allocated and coalesce(band_level, '') <> 'bomb';
end $$;
revoke execute on function public.desk_band_set(int, numeric, numeric) from public, anon;
grant execute on function public.desk_band_set(int, numeric, numeric) to authenticated;

-- the one-time check of what is on the site now (run on the owner's word, 22/11): over the range → hidden, to review
create or replace function public._price_bands_apply() returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.listings set state = 'hidden', price_hold = true where state = 'approved' and over_range and coalesce(band_level, '') <> 'bomb';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public._price_bands_apply() from public, anon, authenticated;

-- work out levels and marks for every plot now (nothing is hidden by this: no plot is being published)
update public.listings set band_level = band_level;

-- the request cards show "over the range" from the new mark
create or replace function public._desk_req_json(r public.requests, l public.listings) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('batch', r.batch, 'l_missing', l.missing, 'l_level', l.band_level, 'l_hold', l.price_hold) || jsonb_build_object('id', r.id, 'via', r.via, 'stage', r.stage, 'name', r.name, 'phone', r.phone, 'listing_id', r.listing_id,
      'zone', r.zone, 'district', r.district, 'budget', r.budget, 'created_at', r.created_at,
      'tl_id', r.tl_id, 'sup_id', r.sup_id, 'sales_id', r.sales_id, 'tl_mode', r.tl_mode, 'tl_ack', r.tl_ack,
      'st_key', r.st_key, 'st_at', r.st_at, 'st_due', r.st_due, 'outcome', r.outcome, 'outcome_reason', r.outcome_reason, 'outcome_summary', r.outcome_summary,
      'first_at', r.first_at, 'closed_at', r.closed_at, 'web_task', r.web_task, 'ql', r.ql_state, 'ql_at', r.ql_at, 'ql_note', r.ql_note, 'cx', r.cx_action, 'cx_until', r.cx_until, 'cx_eval', r.cx_eval, 'cx_count', r.cx_count, 'kind', r.kind, 'client_late', r.client_late,
      'code', l.code, 'l_district', l.district, 'l_zone', l.zone, 'l_area', coalesce(l.area_final, l.area_orig), 'l_price', l.price, 'l_paid', l.paid, 'l_over', l.over_range,
      'notes', (select count(*) from public.request_notes n where n.request_id = r.id),
      'legs', coalesce((select jsonb_agg(jsonb_build_object('staff_id', g.staff_id, 'role', g.role, 'kind', g.kind, 'label', g.label, 'start', g.started_at, 'due', g.due_at, 'end', g.ended_at) order by g.id)
        from public.request_legs g where g.request_id = r.id), '[]'::jsonb))
$$;

-- (applied as price_bands_request_unit) the plot inside a request carries its level and hold
do $m$
declare d text := pg_get_functiondef('public.desk_request'::regproc); a text := '''missing'', l.missing)';
begin
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'desk_request patch: expected 1 match'; end if;
  execute replace(d, a, '''missing'', l.missing, ''band_level'', l.band_level, ''price_hold'', l.price_hold)');
end $m$;
