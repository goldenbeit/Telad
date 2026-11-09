-- "المطلوب دفعه + الأوفر" is now one number (paid). over_amount is no longer collected.
-- Sellers may give the original area, the area after legalization, or both.
alter table public.listings alter column area_orig drop not null;
alter table public.listings alter column area_final drop not null;
alter table public.listings add constraint listings_area_present check (area_orig is not null or area_final is not null);
alter table public.listings alter column over_amount drop not null;
comment on column public.listings.paid is 'المطلوب دفعه + الأوفر (رقم واحد يكتبه البائع)';
comment on column public.listings.over_amount is 'Legacy: no longer collected; paid already includes the over amount.';

create or replace function public.submit_offer(p jsonb) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_phone text := p->>'phone';
  v_ao numeric := nullif(p->>'area_orig','')::numeric; v_af numeric := nullif(p->>'area_final','')::numeric;
begin
  if coalesce(v_phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p->>'name',''))) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if coalesce(v_ao,0) <= 0 and coalesce(v_af,0) <= 0 then raise exception 'invalid_area' using errcode = '22023'; end if;
  if (select count(*) from public.listing_private pr join public.listings l on l.id = pr.listing_id
      where pr.phone = v_phone and l.created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_offers' using errcode = '22023'; end if;
  if (select count(*) from public.listings where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'busy' using errcode = '22023'; end if;
  insert into public.listings (zone, district, neighborhood, block, area_orig, area_final, facade, view_type, price, paid, inst_left, description)
  values (p->>'zone', (p->>'district')::smallint, nullif(p->>'neighborhood','')::smallint, nullif(btrim(coalesce(p->>'block','')),''),
    case when v_ao > 0 then v_ao end, case when v_af > 0 then v_af end, nullif(p->>'facade',''), nullif(p->>'view_type',''),
    round((p->>'price')::numeric, 1), round((p->>'paid')::numeric, 1), (p->>'inst_left')::smallint,
    btrim(coalesce(p->>'description','')))
  returning id into v_id;
  insert into public.listing_private (listing_id, owner_name, phone, plot_number)
  values (v_id, btrim(p->>'name'), v_phone, nullif(btrim(coalesce(p->>'plot_number','')),''));
  return v_id;
end $$;

revoke execute on function public.submit_offer(jsonb) from public;
grant execute on function public.submit_offer(jsonb) to anon, authenticated;

-- Requests list: show whichever area the seller gave.
create or replace function public.admin_requests() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query select to_jsonb(r) || jsonb_build_object('code', l.code, 'l_district', l.district, 'l_area', coalesce(l.area_final, l.area_orig), 'l_price', l.price,
      'owner_name', pr.owner_name, 'owner_phone', pr.phone)
    from public.requests r left join public.listings l on l.id = r.listing_id left join public.listing_private pr on pr.listing_id = l.id
    order by (r.state = 'new') desc, r.created_at desc;
end $$;
