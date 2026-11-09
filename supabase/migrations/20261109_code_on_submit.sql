-- The seller gets the unit code right away (shown in the success popup), instead of on approval.
-- Pending listings stay private; admin_set_state keeps an existing code.
drop function if exists public.submit_offer(jsonb);
create function public.submit_offer(p jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_code text; v_phone text := p->>'phone';
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
  update public.listings
    set code = (case zone when 'القادسية' then 'Q' else 'A' end) || to_char(now() at time zone 'Africa/Cairo', 'YYMM') || '-' || id
    where id = v_id returning code into v_code;
  insert into public.listing_private (listing_id, owner_name, phone, plot_number)
  values (v_id, btrim(p->>'name'), v_phone, nullif(btrim(coalesce(p->>'plot_number','')),''));
  return v_code;
end $$;

revoke execute on function public.submit_offer(jsonb) from public, anon, authenticated;
grant execute on function public.submit_offer(jsonb) to anon, authenticated;
