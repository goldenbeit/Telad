-- Offer paths: allocated (مخصصة) and unallocated (غير مخصصة) plots.
-- Unallocated plots have no district/neighborhood/block/plot/facade/view; only zone + أصل المساحة.
alter table public.listings
  add column if not exists allocated boolean not null default true,
  add column if not exists on_list boolean,            -- غير مخصصة: على الكشف؟
  add column if not exists check_paid boolean,         -- غير مخصصة: شيك التقنين مدفوع؟
  add column if not exists stage text,                 -- مخصصة: not_completed | completed | received
  add column if not exists pay jsonb not null default '{}'::jsonb;  -- breakdown of المتبقي

alter table public.listings alter column district drop not null;
alter table public.listings drop constraint if exists listings_zone_district;
alter table public.listings add constraint listings_zone_district check (
  (allocated and ((zone = 'القادسية' and district = any (array[1, 8, 9, 10, 12, 17, 20, 22, 23]))
               or (zone = 'الأمل' and district = any (array[28, 29, 30, 31, 32, 33, 35, 36]))))
  or (not allocated and district is null));
alter table public.listings drop constraint if exists listings_stage_check;
alter table public.listings add constraint listings_stage_check check (stage is null or stage in ('not_completed', 'completed', 'received'));
alter table public.listings drop constraint if exists listings_pay_size;
alter table public.listings add constraint listings_pay_size check (pg_column_size(pay) < 4000);
alter table public.listings drop constraint if exists listings_inst_left_check;
alter table public.listings add constraint listings_inst_left_check check (inst_left between 0 and 3);

create or replace function public.submit_offer(p jsonb)
returns text language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_code text; v_phone text := p->>'phone';
  v_alloc boolean := coalesce((p->>'allocated')::boolean, true);
  v_ao numeric := nullif(p->>'area_orig','')::numeric; v_af numeric := nullif(p->>'area_final','')::numeric;
  v_photo text := nullif(p->>'photo',''); v_letter text := nullif(p->>'letter','');
  v_pay jsonb := case when jsonb_typeof(p->'pay') = 'object' then p->'pay' else '{}'::jsonb end;
begin
  if coalesce(v_phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p->>'name',''))) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_alloc and coalesce(v_ao,0) <= 0 and coalesce(v_af,0) <= 0 then raise exception 'invalid_area' using errcode = '22023'; end if;
  if not v_alloc and coalesce(v_ao,0) <= 0 then raise exception 'invalid_area' using errcode = '22023'; end if;
  if v_photo is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = v_photo and o.name like 'incoming/%') then v_photo := null; end if;
  if v_letter is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'allocation-letters' and o.name = v_letter and o.name like 'incoming/%') then v_letter := null; end if;
  if (select count(*) from public.listing_private pr join public.listings l on l.id = pr.listing_id
      where pr.phone = v_phone and l.created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_offers' using errcode = '22023'; end if;
  if (select count(*) from public.listings where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'busy' using errcode = '22023'; end if;
  insert into public.listings (allocated, on_list, check_paid, stage, pay, zone, district, neighborhood, block, area_orig, area_final,
    facade, view_type, price, paid, inst_left, description, photo_path)
  values (v_alloc,
    case when not v_alloc then (p->>'on_list')::boolean end,
    case when not v_alloc then (p->>'check_paid')::boolean end,
    case when v_alloc then nullif(p->>'stage','') end,
    v_pay, p->>'zone',
    case when v_alloc then (p->>'district')::smallint end,
    case when v_alloc then nullif(p->>'neighborhood','')::smallint end,
    case when v_alloc then nullif(btrim(coalesce(p->>'block','')),'') end,
    case when v_ao > 0 then v_ao end, case when v_af > 0 then v_af end,
    case when v_alloc then nullif(p->>'facade','') end, case when v_alloc then nullif(p->>'view_type','') end,
    round((p->>'price')::numeric, 1), round((p->>'paid')::numeric, 1), (p->>'inst_left')::smallint,
    btrim(coalesce(p->>'description','')), v_photo)
  returning id into v_id;
  update public.listings
    set code = (case zone when 'القادسية' then 'Q' else 'A' end) || to_char(now() at time zone 'Africa/Cairo', 'YYMM') || '-' || id
    where id = v_id returning code into v_code;
  insert into public.listing_private (listing_id, owner_name, phone, plot_number, letter_path)
  values (v_id, btrim(p->>'name'), v_phone, case when v_alloc then nullif(btrim(coalesce(p->>'plot_number','')),'') end,
    case when v_alloc then v_letter end);
  return v_code;
end $function$;

-- Admin edit: an empty district means the plot is unallocated.
create or replace function public.admin_update_listing(p_id bigint, p jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_ao numeric := nullif(p->>'area_orig','')::numeric; v_af numeric := nullif(p->>'area_final','')::numeric;
  v_d smallint := nullif(p->>'district','')::smallint;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if coalesce(p->>'phone','') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  update public.listings set
    allocated = v_d is not null,
    zone = p->>'zone', district = v_d, neighborhood = case when v_d is not null then nullif(p->>'neighborhood','')::smallint end,
    block = case when v_d is not null then nullif(btrim(coalesce(p->>'block','')),'') end,
    area_orig = case when v_ao > 0 then v_ao end, area_final = case when v_af > 0 then v_af end,
    facade = case when v_d is not null then nullif(p->>'facade','') end, view_type = case when v_d is not null then nullif(p->>'view_type','') end,
    price = round((p->>'price')::numeric, 1), paid = round((p->>'paid')::numeric, 1), inst_left = (p->>'inst_left')::smallint,
    description = btrim(coalesce(p->>'description',''))
  where id = p_id;
  if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.listing_private set owner_name = btrim(p->>'name'), phone = p->>'phone',
    plot_number = nullif(btrim(coalesce(p->>'plot_number','')),'')
  where listing_id = p_id;
end $function$;
