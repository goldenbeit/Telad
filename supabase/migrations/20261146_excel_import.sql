-- Upload plots from an Excel sheet in the desk (23/11).
-- Team leader and above. Three destinations: verification at a salesperson (48h, like the sales sheets),
-- verification at the team leaders (they distribute), or straight onto the site (published and verified;
-- over the price band goes to price review by the band trigger, missing data goes to the team leaders instead).
-- The source name (e.g. a broker) shows in the desk only.

create table if not exists public.listing_imports (
  id bigserial primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  dest text not null check (dest in ('sales', 'tl', 'publish')),
  by_name text,
  by_uid uuid,
  created_at timestamptz not null default now(),
  total int not null default 0,
  published int not null default 0,
  review int not null default 0,
  to_tl int not null default 0,
  to_sales int not null default 0
);
alter table public.listing_imports enable row level security;
revoke all on public.listing_imports from anon, authenticated;

alter table public.listings add column if not exists import_id bigint references public.listing_imports(id) on delete set null;
create index if not exists listings_import_id_idx on public.listings(import_id);

-- imported plots may come without the number of installments left
alter table public.listings drop constraint if exists listings_inst_left_required;
alter table public.listings add constraint listings_inst_left_required
  check (inst_left is not null or (pay ->> 'src') in ('sheet', 'import'));

create or replace function public._imp_num(t text) returns numeric language sql immutable set search_path = '' as $$
  select case when btrim(coalesce(t, '')) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(t)::numeric end $$;

create or replace function public._imp_phone(t text) returns text language sql immutable set search_path = '' as $$
  select case when x ~ '^01[0125][0-9]{8}$' then x when x ~ '^1[0125][0-9]{8}$' then '0' || x
              when x ~ '^201[0125][0-9]{8}$' then substr(x, 2) end
  from (select regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g') x) s $$;

-- one sheet row (jsonb) -> a clean listings record (not inserted)
create or replace function public._imp_listing(j jsonb) returns public.listings language plpgsql immutable set search_path = '' as $$
declare l public.listings; z text; d int; n int; a boolean; v numeric;
begin
  z := nullif(btrim(j ->> 'zone'), '');
  if z is distinct from 'القادسية' and z is distinct from 'الأمل' then z := null; end if;
  a := case j ->> 'alloc' when 'true' then true when 'false' then false end;
  d := public._imp_num(j ->> 'district')::int;
  if a is false or z is null or d is null
     or not ((z = 'القادسية' and d in (8, 9, 10, 12, 17, 20, 22, 23)) or (z = 'الأمل' and d in (28, 29, 30, 31, 32, 33, 35, 36))) then d := null; end if;
  n := public._imp_num(j ->> 'nb')::int; if n not between 1 and 10 then n := null; end if;
  l.zone := z; l.allocated := a; l.district := d; l.neighborhood := n;
  l.block := left(nullif(btrim(j ->> 'block'), ''), 40);
  v := public._imp_num(j ->> 'area_orig'); l.area_orig := case when v > 0 and v < 100000 then v end;
  v := public._imp_num(j ->> 'area_final'); l.area_final := case when v > 0 and v < 100000 then v end;
  l.paid := public._imp_num(j ->> 'paid');
  v := public._imp_num(j ->> 'price'); l.price := case when v > 0 and (l.paid is null or l.paid <= v) then v end;
  l.stage := case when j ->> 'stage' in ('not_completed', 'completed', 'received') and a is true then j ->> 'stage' end;
  v := public._imp_num(j ->> 'inst_left'); l.inst_left := case when v between 0 and 3 then v::int end;
  l.description := coalesce(left(nullif(btrim(j ->> 'descr'), ''), 1000), '');
  l.pay := '{"v":1,"src":"import","items":[]}'::jsonb;
  l.state := 'pending';
  return l;
end $$;

-- same rules as _listing_missing, before the row exists
create or replace function public._imp_missing(l public.listings, p_phone text) returns text[] language sql immutable set search_path = '' as $$
  select nullif(array_remove(array[
    case when l.zone is null then 'المنطقة' end,
    case when l.allocated is null or (l.allocated and l.district is null) then 'الحي' end,
    case when l.area_orig is null and l.area_final is null then 'المساحة' end,
    case when l.price is null or l.paid is null then 'السعر' end,
    case when p_phone is null then 'رقم المعلن' end], null), '{}') $$;

create or replace function public._imp_over(l public.listings) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare b public.price_bands;
begin
  if l.paid is null or l.zone is null or l.allocated is null then return false; end if;
  b := public._band_of(l);
  return b.id is null or l.paid > b.max_paid;
end $$;

-- the review screen before uploading: what is missing, what is over the band, what may already be on the platform
create or replace function public.desk_import_check(p_rows jsonb) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'too_many'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('i', e.o - 1, 'missing', public._imp_missing(x.l, x.ph), 'over', public._imp_over(x.l),
      'dup', (select jsonb_agg(distinct l2.code) from public.listings l2 join public.listing_private p2 on p2.listing_id = l2.id
              where x.ph is not null and p2.phone = x.ph and l2.state <> 'rejected'
                and ((x.plot is not null and btrim(p2.plot_number) = x.plot and (l2.block is null or (x.l).block is null or l2.block = (x.l).block))
                  or ((x.l).paid is not null and l2.paid = (x.l).paid
                      and coalesce(l2.area_final, l2.area_orig) = coalesce((x.l).area_final, (x.l).area_orig)))))
    order by e.o), '[]'::jsonb)
    from jsonb_array_elements(p_rows) with ordinality e(j, o)
    cross join lateral (select public._imp_listing(e.j) l, public._imp_phone(e.j ->> 'phone') ph, nullif(btrim(e.j ->> 'plot'), '') plot) x);
end $$;

create or replace function public.desk_import(p_rows jsonb, p_dest text, p_name text, p_sales bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_imp bigint; j jsonb; l public.listings; lid bigint; ph text; rid bigint; v_sid bigint; v_st public.staff;
  v_name text := btrim(coalesce(p_name, '')); v_owner text; v_miss text[]; v_by jsonb := '{}'::jsonb; v_tl int := 0; k text;
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_dest not in ('sales', 'tl', 'publish') then raise exception 'bad_dest'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'name_required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'empty'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'too_many'; end if;
  if p_sales is not null and not exists (select 1 from public.staff s where s.id = p_sales and s.active and s.role in ('senior', 'junior')) then
    raise exception 'bad_sales'; end if;

  insert into public.listing_imports (name, dest, by_name, by_uid) values (v_name, p_dest, public._actor(), (select auth.uid()))
    returning id into v_imp;

  for j in select value from jsonb_array_elements(p_rows) loop
    l := public._imp_listing(j); ph := public._imp_phone(j ->> 'phone');
    v_owner := coalesce(left(nullif(btrim(j ->> 'owner'), ''), 80), 'غير مذكور');
    insert into public.listings (zone, district, neighborhood, block, area_orig, area_final, allocated, stage, paid, price, inst_left,
        pay, description, state, missing, import_id)
      values (l.zone, l.district, l.neighborhood, l.block, l.area_orig, l.area_final, l.allocated, l.stage, l.paid, l.price, l.inst_left,
        l.pay, l.description, 'pending', array['المساحة'], v_imp)
      returning id into lid;
    update public.listings set code = case zone when 'القادسية' then 'Q' when 'الأمل' then 'A' else 'N' end
      || to_char(now() at time zone 'Africa/Cairo', 'YYMM') || '-' || id where id = lid;
    insert into public.listing_private (listing_id, owner_name, phone, phone2, plot_number)
      values (lid, v_owner, ph, public._imp_phone(j ->> 'phone2'), left(nullif(btrim(j ->> 'plot'), ''), 40));
    v_miss := public._listing_missing(lid);
    update public.listings set missing = v_miss where id = lid;

    if p_dest = 'publish' and v_miss is null then
      -- the band trigger hides it into price review if it is over the max
      update public.listings set state = 'approved', verified = true, verified_at = now() where id = lid;
      continue;
    end if;

    v_sid := null;
    if p_dest = 'sales' then
      v_sid := coalesce((select s.id from public.staff s where s.id = public._imp_num(j ->> 'sales_id')::bigint
                           and s.active and s.role in ('senior', 'junior')), p_sales);
    end if;
    if v_sid is not null then
      select * into v_st from public.staff where id = v_sid;
      insert into public.requests (kind, listing_id, name, phone, zone, district, stage, tl_mode, sales_id, batch)
        values ('verify', lid, coalesce(v_owner, 'غير مذكور'), ph, l.zone, l.district, 'sales', 'confirm', v_sid, 'imp-' || v_imp)
        returning id into rid;
      insert into public.request_legs (request_id, staff_id, role, kind, due_at) values (rid, v_sid, v_st.role, 't', now() + interval '48 hours');
      insert into public.request_events (request_id, body) values (rid, 'نزلت من شيت "' || v_name || '" · المهلة 48 ساعة');
      v_by := jsonb_set(v_by, array[v_sid::text], to_jsonb(coalesce((v_by ->> v_sid::text)::int, 0) + 1));
    else
      insert into public.requests (kind, listing_id, name, phone, zone, district, stage, tl_mode, batch)
        values ('verify', lid, coalesce(v_owner, 'غير مذكور'), ph, l.zone, l.district, 'tl', 'confirm', case when ph is null then 'imp-' || v_imp end)
        returning id into rid;
      insert into public.request_legs (request_id, role, due_at) values (rid, 'tl', now() + interval '1 day');
      insert into public.request_events (request_id, body) values (rid, 'نزلت من شيت "' || v_name || '"'
        || case when p_dest = 'publish' then ' · بياناتها ناقصة فمتنشرتش' else '' end);
      v_tl := v_tl + 1;
    end if;
  end loop;

  for k in select jsonb_object_keys(v_by) loop
    perform public._notify(array[(select coalesce(s.user_id, public._staff_uid(s.id)) from public.staff s where s.id = k::bigint)], null,
      'نزلك ' || (v_by ->> k) || ' قطعة من شيت "' || v_name || '" في "عندي". كمّل بياناتها خلال 48 ساعة.');
  end loop;
  if v_tl > 0 then
    perform public._notify(public._users_of('tl'), null, 'نزل ' || v_tl || ' قطعة من شيت "' || v_name || '" في "التوثيق". وزّعهم.');
  end if;

  update public.listing_imports i set
    total = (select count(*) from public.listings x where x.import_id = v_imp),
    published = (select count(*) from public.listings x where x.import_id = v_imp and x.state = 'approved'),
    review = (select count(*) from public.listings x where x.import_id = v_imp and x.price_hold),
    to_tl = v_tl,
    to_sales = (select coalesce(sum(value::int), 0) from jsonb_each_text(v_by))
  where i.id = v_imp;
  return (select to_jsonb(i) from public.listing_imports i where i.id = v_imp);
end $$;

-- the uploads so far (the tab's history, and the source name of each plot)
create or replace function public.desk_imports() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public._can_price_review() or public._can_plots_view()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object(
      'live', (select count(*) from public.listings x where x.import_id = i.id and x.state = 'approved')) order by i.id desc), '[]'::jsonb)
    from public.listing_imports i);
end $$;

revoke execute on function public._imp_num(text), public._imp_phone(text), public._imp_listing(jsonb),
  public._imp_missing(public.listings, text), public._imp_over(public.listings) from public, anon, authenticated;
revoke execute on function public.desk_import_check(jsonb), public.desk_import(jsonb, text, text, bigint), public.desk_imports() from public, anon;
grant execute on function public.desk_import_check(jsonb), public.desk_import(jsonb, text, text, bigint), public.desk_imports() to authenticated;

-- (applied as excel_import_desc and excel_import_owner: the two fixes above, already folded into this file)

-- applied as excel_import_publish: the team leader's "sound" publishes a pending plot from an upload too
-- (it did that only for the sales sheets, which carry a batch)
do $m$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  a text := $a$(state = 'pending' and r.batch is not null)$a$;
begin
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 2 then raise exception 'patch target not found twice'; end if;
  execute replace(d, a, $b$(state = 'pending' and (r.batch is not null or import_id is not null))$b$);
end $m$;
