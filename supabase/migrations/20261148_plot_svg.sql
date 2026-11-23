-- The plot card's map (23/11, shape "ب" chosen by the owner): the plot in amber, the plots around it without numbers,
-- gardens in green, services by name, the street width on the facade side, north and a 20 m scale.
-- Drawn on the server from the plan's drawing (05_plots / 05_services geojson, drawing coordinates, not geographic);
-- the visitor receives only the finished SVG, in coordinates relative to the plot — no plan coordinates, no plot numbers.

create extension if not exists postgis with schema extensions;

create table if not exists public.map_plots (
  district smallint,
  nb smallint,
  block_no smallint,
  plot_no text,
  street_w numeric,
  facade_dir text,
  geom extensions.geometry not null
);
create index if not exists map_plots_gix on public.map_plots using gist (geom);
create index if not exists map_plots_key on public.map_plots (district, nb, block_no, plot_no);
alter table public.map_plots enable row level security;
revoke all on public.map_plots from anon, authenticated;

create table if not exists public.map_services (
  kind text,
  geom extensions.geometry not null
);
create index if not exists map_services_gix on public.map_services using gist (geom);
alter table public.map_services enable row level security;
revoke all on public.map_services from anon, authenticated;

-- the finished drawing per listing; read by the site for published plots, and by the team for any
create table if not exists public.listing_map_svg (
  listing_id bigint primary key,
  svg text not null
);
alter table public.listing_map_svg enable row level security;
revoke all on public.listing_map_svg from anon, authenticated;
grant select on public.listing_map_svg to anon, authenticated;
drop policy if exists "published plot maps" on public.listing_map_svg;
create policy "published plot maps" on public.listing_map_svg for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.state = 'approved'));
drop policy if exists "team reads plot maps" on public.listing_map_svg;
create policy "team reads plot maps" on public.listing_map_svg for select to authenticated using (public._is_team());

-- the drawing for one plan plot (its key as in plot_map)
create or replace function public._map_svg(p_d int, p_n int, p_b int, p_p text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare t public.map_plots; cx float8; cy float8; R constant float8 := 55; env extensions.geometry; o text; lx float8 := 0; ly float8 := 0;
begin
  select * into t from public.map_plots m where m.district = p_d and m.nb is not distinct from p_n and m.block_no = p_b and m.plot_no = p_p limit 1;
  if t.geom is null then return null; end if;
  cx := (extensions.st_xmin(t.geom) + extensions.st_xmax(t.geom)) / 2; cy := (extensions.st_ymin(t.geom) + extensions.st_ymax(t.geom)) / 2;
  env := extensions.st_makeenvelope(cx - R, cy - R, cx + R, cy + R, extensions.st_srid(t.geom));
  o := '<svg viewBox="-55 -55 110 110" xmlns="http://www.w3.org/2000/svg" class="pmap" role="img" aria-label="خريطة القطعة">'
    || '<defs><clipPath id="pmc"><rect x="-55" y="-55" width="110" height="110" rx="6"/></clipPath></defs><g clip-path="url(#pmc)">'
    || '<rect x="-55" y="-55" width="110" height="110" fill="#FBF8F2"/>';
  -- services: gardens / green strips in green, the rest pale blue
  o := o || coalesce((select string_agg(format('<path d="%s" fill="%s" stroke="%s" stroke-width=".35"/>',
      extensions.st_assvg(extensions.st_translate(s.geom, -cx, -cy), 0, 1),
      case when s.kind in ('شريط أخضر', 'حديقة صغيرة', 'حديقة كبيرة') then '#D5E6C8' else '#E6E9F2' end,
      case when s.kind in ('شريط أخضر', 'حديقة صغيرة', 'حديقة كبيرة') then '#9DC08B' else '#C5CBDA' end), '')
    from public.map_services s where s.geom operator(extensions.&&) env and extensions.geometrytype(s.geom) in ('POLYGON', 'MULTIPOLYGON')), '');
  -- the plots around, without numbers
  o := o || '<g fill="#EFE8DA" stroke="#D6C9B1" stroke-width=".3">' || coalesce((select string_agg(format('<path d="%s"/>',
      extensions.st_assvg(extensions.st_translate(p.geom, -cx, -cy), 0, 1)), '')
    from public.map_plots p where p.geom operator(extensions.&&) env and not (p.district = t.district and p.nb is not distinct from t.nb and p.block_no = t.block_no and p.plot_no = t.plot_no)), '') || '</g>';
  -- the plot
  o := o || format('<path d="%s" fill="#F0A63A" stroke="#15213B" stroke-width=".9" stroke-linejoin="round"/>', extensions.st_assvg(extensions.st_translate(t.geom, -cx, -cy), 0, 1));
  -- service names (not the green ones), inside the frame
  o := o || coalesce((select string_agg(format('<text x="%s" y="%s" class="sl">%s</text>', round(x::numeric, 1), round(y::numeric, 1), lbl), '') from (
      select (extensions.st_xmin(s.geom) + extensions.st_xmax(s.geom)) / 2 - cx x, cy - (extensions.st_ymin(s.geom) + extensions.st_ymax(s.geom)) / 2 y,
        case s.kind when 'مسجد' then 'مسجد' when 'مدرسة / تعليمي' then 'مدرسة' when 'حضانة' then 'حضانة' when 'صحي' then 'صحي'
          when 'تجاري / إداري' then 'تجاري' when 'خدمات (غير محددة)' then 'خدمات' when 'رياضي / ترفيهي' then 'نادي' end lbl
      from public.map_services s where s.geom operator(extensions.&&) env) z where lbl is not null and abs(x) < R - 6 and abs(y) < R - 4), '');
  -- the street width on the facade side
  if t.street_w > 0 and t.facade_dir is not null then
    if t.facade_dir = 'بحرية' then ly := -((extensions.st_ymax(t.geom) - cy) + t.street_w / 2); end if;
    if t.facade_dir = 'قبلية' then ly := (cy - extensions.st_ymin(t.geom)) + t.street_w / 2; end if;
    if t.facade_dir = 'شرقية' then lx := (extensions.st_xmax(t.geom) - cx) + t.street_w / 2; end if;
    if t.facade_dir = 'غربية' then lx := -((cx - extensions.st_xmin(t.geom)) + t.street_w / 2); end if;
    o := o || format('<g transform="translate(%s,%s)"><rect x="-6" y="-3" width="12" height="6" rx="3" fill="#15213B"/><text y="1.4" class="wl">%s م</text></g>',
      round(lx::numeric, 1), round(ly::numeric, 1), round(t.street_w)::text);
  end if;
  o := o || '</g><g transform="translate(48,-47)"><circle r="5" fill="#fff" stroke="#E7DFD0" stroke-width=".4"/><path d="M0,-3.4 L2,1.6 L0,.6 L-2,1.6Z" fill="#15213B"/><text y="8.5" class="nl">ش</text></g>'
    || '<g transform="translate(-50,50)"><rect x="-1.5" y="-5.5" width="25" height="7.5" rx="2" fill="#fff" opacity=".9"/><path d="M0,0H20" stroke="#15213B" stroke-width=".8"/><text x="10" y="-1.6" class="nl">20 م</text></g></svg>';
  return o;
end $$;

-- keep the drawing in step with the card: drawn when a listing gets (or changes) its card, removed when it loses it
create or replace function public._listings_map_svg() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plot text; r public.plot_map; v_svg text;
begin
  if new.map_state = 'card' then
    if tg_op = 'INSERT' or old.map_card is distinct from new.map_card or old.district is distinct from new.district
       or old.neighborhood is distinct from new.neighborhood or old.block is distinct from new.block
       or not exists (select 1 from public.listing_map_svg where listing_id = new.id) then
      select plot_number into v_plot from public.listing_private where listing_id = new.id;
      select * into r from public._map_find(new.district, new.neighborhood, new.block, v_plot) limit 1;
      v_svg := case when r.plot_no is not null then public._map_svg(r.district, r.nb, r.block_no, r.plot_no) end;
      if v_svg is null then delete from public.listing_map_svg where listing_id = new.id;
      else insert into public.listing_map_svg (listing_id, svg) values (new.id, v_svg) on conflict (listing_id) do update set svg = excluded.svg; end if;
    end if;
  elsif tg_op = 'UPDATE' and old.map_state = 'card' then
    delete from public.listing_map_svg where listing_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists listings_map_svg on public.listings;
create trigger listings_map_svg after insert or update on public.listings for each row execute function public._listings_map_svg();

-- loading the drawing: the owner uploads 05_plots / 05_services from the desk (WKT made in the browser, in chunks)
-- plots: [[district, neighborhood, block_no, plot_no, main_street_width_m, main_facade_dir, wkt], ...]; services: [[type, wkt], ...]
create or replace function public.desk_geo_load(p_kind text, p_rows jsonb, p_reset boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'too_many'; end if;
  if p_kind = 'plots' then
    if p_reset then delete from public.map_plots where true; end if;
    insert into public.map_plots (district, nb, block_no, plot_no, street_w, facade_dir, geom)
    select nullif(e ->> 0, '')::smallint, nullif(e ->> 1, '')::smallint, nullif(e ->> 2, '')::smallint, ltrim(public._map_digits(e ->> 3), '0'),
           nullif(e ->> 4, '')::numeric, nullif(e ->> 5, ''), extensions.st_geomfromtext(e ->> 6)
    from jsonb_array_elements(p_rows) e where coalesce(e ->> 6, '') like 'POLYGON%';
    return (select count(*) from public.map_plots);
  elsif p_kind = 'services' then
    if p_reset then delete from public.map_services where true; end if;
    insert into public.map_services (kind, geom)
    select nullif(e ->> 0, ''), extensions.st_geomfromtext(e ->> 1) from jsonb_array_elements(p_rows) e where coalesce(e ->> 1, '') like 'POLYGON%';
    return (select count(*) from public.map_services);
  end if;
  raise exception 'bad_kind';
end $$;

create or replace function public.desk_map_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public._can_price_review() or public._can_plots_view()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_build_object('rows', m.rows, 'loaded_at', m.loaded_at, 'loaded_by', m.loaded_by) from public.plot_map_meta m where m.id = 1), '{}'::jsonb)
    || jsonb_build_object('listings', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (
         select coalesce(map_state, 'incomplete') s, count(*) n from public.listings where state in ('approved', 'pending', 'hidden') group by 1) x),
       'live_cards', (select count(*) from public.listings where state = 'approved' and map_state = 'card'),
       'geo_plots', (select count(*) from public.map_plots), 'geo_services', (select count(*) from public.map_services),
       'maps', (select count(*) from public.listing_map_svg));
end $$;

-- recompute every listing's card and drawing (after a new plan or a new drawing)
create or replace function public.desk_map_finish() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.plot_map_meta (id, rows, loaded_at, loaded_by) values (1, (select count(*) from public.plot_map), now(), public._actor())
    on conflict (id) do update set rows = excluded.rows, loaded_at = excluded.loaded_at, loaded_by = excluded.loaded_by;
  delete from public.listing_map_svg where true;
  update public.listings set map_state = map_state where true;
  return public.desk_map_stats();
end $$;

revoke execute on function public._map_svg(int, int, int, text), public._listings_map_svg() from public, anon, authenticated;
revoke execute on function public.desk_geo_load(text, jsonb, boolean) from public, anon;
grant execute on function public.desk_geo_load(text, jsonb, boolean) to authenticated;
