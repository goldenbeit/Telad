-- Imported listings may not state how many installments are left.
alter table public.listings alter column inst_left drop not null;
-- Only the units imported from the sheet may have no installments count; everything else still needs it.
alter table public.listings add constraint listings_inst_left_required check (inst_left is not null or pay->>'src' = 'sheet');

-- Admin edit: an empty district means the plot is unallocated; an empty inst_left is saved as null.
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
    price = round((p->>'price')::numeric, 1), paid = round((p->>'paid')::numeric, 1), inst_left = nullif(p->>'inst_left','')::smallint,
    description = btrim(coalesce(p->>'description',''))
  where id = p_id;
  if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.listing_private set owner_name = btrim(p->>'name'), phone = p->>'phone',
    plot_number = nullif(btrim(coalesce(p->>'plot_number','')),'')
  where listing_id = p_id;
end $function$;
