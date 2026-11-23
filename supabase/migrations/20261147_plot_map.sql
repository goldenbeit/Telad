-- Plot card from the city plan (23/11).
-- plot_map: one row per plot of the New Obour plan (plot_features.csv), private (no client reads it).
-- Every listing is matched on the server by district + neighborhood + block + plot number; the visitor gets only
-- listings.map_card (facade, two features, dimensions) — never the plot number, the block code or the plan row.

create table if not exists public.plot_map (
  district smallint not null,
  nb smallint,
  block_no smallint,
  block_code text,
  plot_no text not null,
  status text,
  area numeric,
  feats jsonb not null default '[]'::jsonb
);
create unique index if not exists plot_map_key on public.plot_map (district, nb, block_no, plot_no) where block_no is not null;
create index if not exists plot_map_code on public.plot_map (block_code, plot_no);
alter table public.plot_map enable row level security;
revoke all on public.plot_map from anon, authenticated;

create table if not exists public.plot_map_meta (
  id int primary key default 1 check (id = 1),
  rows int not null default 0,
  loaded_at timestamptz,
  loaded_by text
);
alter table public.plot_map_meta enable row level security;
revoke all on public.plot_map_meta from anon, authenticated;

-- map_card: shown on the site (null unless the plot matched cleanly); map_state / map_note: for the desk
-- (card / review / nomatch / multi / incomplete / nocard)
alter table public.listings add column if not exists map_card jsonb, add column if not exists map_state text, add column if not exists map_note text;

create or replace function public._map_digits(t text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(translate(coalesce(t, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g') $$;

-- the plan rows matching a listing's district / neighborhood / block / plot number (block written freely: 2, 02, 8502, 80502)
create or replace function public._map_find(p_d int, p_n int, p_block text, p_plot text) returns setof public.plot_map
language sql stable security definer set search_path = '' as $$
  with k as (select public._map_digits(p_block) b, ltrim(public._map_digits(p_plot), '0') p)
  select m.* from public.plot_map m, k
  where p_d is not null and k.p <> '' and m.district = p_d and m.plot_no = k.p and (
       (length(k.b) between 1 and 2 and m.nb = p_n and m.block_no = k.b::int)
    or (length(k.b) = 3 and m.nb = p_n and left(k.b, 1) = p_n::text and m.block_no = right(k.b, 2)::int)
    or (length(k.b) >= 4 and (m.block_code = k.b or (length(k.b) = 5 and substr(k.b, 2, 1) = '0' and m.block_code = left(k.b, 1) || substr(k.b, 3)))))
  limit 3 $$;

-- the card from a plan row: the facade line, the two best features, the dimensions (not for estimated boundaries)
create or replace function public._map_card(r public.plot_map) returns jsonb language sql immutable set search_path = '' as $$
  with f as (select value #>> '{}' s, ordinality o from jsonb_array_elements(r.feats) with ordinality),
  fac as (select s from f where s ~ '^(واجهة|واجهات|ناصية|دبل فيس|تربل فيس)' order by o limit 1),
  dim as (select s from f where s like 'الأبعاد%' order by o limit 1),
  ft as (select s from f where s !~ '^(واجهة|واجهات|ناصية|دبل فيس|تربل فيس|الأبعاد)'
    order by case when s like 'تطل على حديقة%' then 1 when s like 'أمام %' then 2 when s ~ '^على .* مباشرة' then 3
      when s like 'تطل على مساحة خضراء%' then 4 when s like 'حديقة على بعد%' then 5 when s like 'على بعد حوالي%' then 6 else 7 end, o limit 2)
  select case when (select s from fac) is null or not exists (select 1 from ft) then null else jsonb_build_object(
    'facade', (select s from fac), 'feats', (select jsonb_agg(s) from ft),
    'dims', case when r.status = 'حدود تقديرية' then null else (select s from dim) end) end $$;

create or replace function public._listings_map() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plot text; v_n int; r public.plot_map; v_card jsonb; v_miss text[];
begin
  new.map_card := null; new.map_note := null;
  select pr.plot_number into v_plot from public.listing_private pr where pr.listing_id = new.id;
  v_miss := array_remove(array[case when new.district is null then 'الحي' end, case when new.neighborhood is null and length(public._map_digits(new.block)) < 4 then 'المجاورة' end,
    case when public._map_digits(new.block) = '' then 'البلوك' end, case when ltrim(public._map_digits(v_plot), '0') = '' then 'رقم القطعة' end], null);
  if cardinality(v_miss) > 0 then new.map_state := 'incomplete'; new.map_note := 'ناقص: ' || array_to_string(v_miss, ' و'); return new; end if;
  select count(*) into v_n from public._map_find(new.district, new.neighborhood, new.block, v_plot);
  if v_n = 0 then new.map_state := 'nomatch'; new.map_note := 'مش موجودة في المخطط'; return new; end if;
  if v_n > 1 then new.map_state := 'multi'; new.map_note := 'متطابقة مع أكتر من قطعة في المخطط'; return new; end if;
  select * into r from public._map_find(new.district, new.neighborhood, new.block, v_plot);
  if r.status = 'تحتاج مراجعة' then new.map_state := 'review'; new.map_note := 'المخطط نفسه بيقول القطعة دي تحتاج مراجعة'; return new; end if;
  -- the plan's area is the plot after legalization (209, 276...), so it is compared with area_final first (checked 23/11 on real plots)
  if coalesce(new.area_final, new.area_orig) is not null and r.area > 0 and abs(coalesce(new.area_final, new.area_orig) - r.area) / r.area > 0.10 then
    new.map_state := 'review'; new.map_note := 'المساحة المكتوبة ' || round(coalesce(new.area_final, new.area_orig)) || ' م² والمخطط ' || round(r.area) || ' م²'; return new; end if;
  v_card := public._map_card(r);
  if v_card is null then new.map_state := 'nocard'; new.map_note := 'المخطط مفيهوش واجهة ومميزات كفاية'; return new; end if;
  new.map_state := 'card'; new.map_card := v_card;
  return new;
end $$;
drop trigger if exists listings_map on public.listings;
create trigger listings_map before insert or update on public.listings for each row execute function public._listings_map();

-- a plot number added or changed: recompute the listing's card
create or replace function public._listing_private_map() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.listings set map_state = map_state where id = new.listing_id;
  return null;
end $$;
drop trigger if exists listing_private_map on public.listing_private;
create trigger listing_private_map after insert or update of plot_number on public.listing_private for each row execute function public._listing_private_map();

-- loading the plan: the owner uploads plot_features.csv from the desk in chunks (the first one replaces the old plan)
-- p_rows: [[district, neighborhood, block_no, block_code, plot_no, status, area_m2, features_ar(json text)], ...]
create or replace function public.desk_map_load(p_rows jsonb, p_reset boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'too_many'; end if;
  if p_reset then delete from public.plot_map where true; end if;
  insert into public.plot_map (district, nb, block_no, block_code, plot_no, status, area, feats)
  select (e ->> 0)::smallint, nullif(e ->> 1, '')::smallint, nullif(e ->> 2, '')::smallint, nullif(e ->> 3, ''),
         ltrim(public._map_digits(e ->> 4), '0'), nullif(e ->> 5, ''), nullif(e ->> 6, '')::numeric,
         coalesce(case when (e ->> 7) ~ '^\s*\[' then (e ->> 7)::jsonb end, '[]'::jsonb)
  from jsonb_array_elements(p_rows) e
  where (e ->> 0) ~ '^[0-9]+$' and ltrim(public._map_digits(e ->> 4), '0') <> ''
  on conflict do nothing;
  return (select count(*) from public.plot_map);
end $$;

create or replace function public.desk_map_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public._can_price_review() or public._can_plots_view()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return (select jsonb_build_object('rows', m.rows, 'loaded_at', m.loaded_at, 'loaded_by', m.loaded_by) from public.plot_map_meta m where m.id = 1)
    || jsonb_build_object('listings', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (
         select coalesce(map_state, 'incomplete') s, count(*) n from public.listings where state in ('approved', 'pending', 'hidden') group by 1) x),
       'live_cards', (select count(*) from public.listings where state = 'approved' and map_state = 'card'));
end $$;

create or replace function public.desk_map_finish() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.plot_map_meta (id, rows, loaded_at, loaded_by) values (1, (select count(*) from public.plot_map), now(), public._actor())
    on conflict (id) do update set rows = excluded.rows, loaded_at = excluded.loaded_at, loaded_by = excluded.loaded_by;
  update public.listings set map_state = map_state where true;
  return public.desk_map_stats();
end $$;

-- one listing's plan match for the desk: the state, the reason, and the plan's full feature list
create or replace function public.desk_plot_map(p_listing bigint) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.listings; v_plot text; r public.plot_map;
begin
  if not public._is_team() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing; if not found then return null; end if;
  select plot_number into v_plot from public.listing_private where listing_id = p_listing;
  if l.map_state in ('card', 'review', 'nocard') then
    select * into r from public._map_find(l.district, l.neighborhood, l.block, v_plot) limit 1;
  end if;
  return jsonb_build_object('state', l.map_state, 'note', l.map_note, 'card', l.map_card,
    'plan', case when r.plot_no is not null then jsonb_build_object('status', r.status, 'area', r.area, 'feats', r.feats) end);
end $$;

revoke execute on function public._map_digits(text), public._map_find(int, int, text, text), public._map_card(public.plot_map),
  public._listings_map(), public._listing_private_map() from public, anon, authenticated;
revoke execute on function public.desk_map_load(jsonb, boolean), public.desk_map_finish(), public.desk_map_stats(), public.desk_plot_map(bigint) from public, anon;
grant execute on function public.desk_map_load(jsonb, boolean), public.desk_map_finish(), public.desk_map_stats(), public.desk_plot_map(bigint) to authenticated;

-- (applied as plot_map + plot_map_area: the area check above was patched in place to use area_final first)
