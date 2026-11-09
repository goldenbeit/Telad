-- Admin can edit any listing (public fields + seller's private data) and delete it.
create or replace function public.admin_update_listing(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_ao numeric := nullif(p->>'area_orig','')::numeric; v_af numeric := nullif(p->>'area_final','')::numeric;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if coalesce(p->>'phone','') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  update public.listings set
    zone = p->>'zone', district = (p->>'district')::smallint, neighborhood = nullif(p->>'neighborhood','')::smallint,
    block = nullif(btrim(coalesce(p->>'block','')),''),
    area_orig = case when v_ao > 0 then v_ao end, area_final = case when v_af > 0 then v_af end,
    facade = nullif(p->>'facade',''), view_type = nullif(p->>'view_type',''),
    price = round((p->>'price')::numeric, 1), paid = round((p->>'paid')::numeric, 1), inst_left = (p->>'inst_left')::smallint,
    description = btrim(coalesce(p->>'description',''))
  where id = p_id;
  if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
  update public.listing_private set owner_name = btrim(p->>'name'), phone = p->>'phone',
    plot_number = nullif(btrim(coalesce(p->>'plot_number','')),'')
  where listing_id = p_id;
end $$;

create or replace function public.admin_delete_listing(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  delete from public.listings where id = p_id;
  if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
end $$;

revoke execute on function public.admin_update_listing(bigint, jsonb), public.admin_delete_listing(bigint) from public, anon, authenticated;
grant execute on function public.admin_update_listing(bigint, jsonb), public.admin_delete_listing(bigint) to authenticated;
