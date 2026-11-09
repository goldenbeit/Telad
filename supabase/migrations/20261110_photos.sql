-- Optional photos with an offer: the unit photo (public once approved) and the allocation letter (admin only).
-- Visitors upload into incoming/<uuid>.<ext>; submit_offer only accepts paths that exist in the right bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-photos', 'listing-photos', true, 3145728, array['image/jpeg','image/png','image/webp']),
  ('allocation-letters', 'allocation-letters', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "visitors upload offer photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id in ('listing-photos','allocation-letters') and (storage.foldername(name))[1] = 'incoming');
create policy "admins read allocation letters" on storage.objects for select to authenticated
  using (bucket_id = 'allocation-letters' and public.is_admin());
create policy "admins delete offer photos" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-photos','allocation-letters') and public.is_admin());

alter table public.listings add column photo_path text check (char_length(photo_path) <= 200);
alter table public.listing_private add column letter_path text check (char_length(letter_path) <= 200);

create or replace function public.submit_offer(p jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_code text; v_phone text := p->>'phone';
  v_ao numeric := nullif(p->>'area_orig','')::numeric; v_af numeric := nullif(p->>'area_final','')::numeric;
  v_photo text := nullif(p->>'photo',''); v_letter text := nullif(p->>'letter','');
begin
  if coalesce(v_phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p->>'name',''))) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if coalesce(v_ao,0) <= 0 and coalesce(v_af,0) <= 0 then raise exception 'invalid_area' using errcode = '22023'; end if;
  if v_photo is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = v_photo and o.name like 'incoming/%') then v_photo := null; end if;
  if v_letter is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'allocation-letters' and o.name = v_letter and o.name like 'incoming/%') then v_letter := null; end if;
  if (select count(*) from public.listing_private pr join public.listings l on l.id = pr.listing_id
      where pr.phone = v_phone and l.created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_offers' using errcode = '22023'; end if;
  if (select count(*) from public.listings where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'busy' using errcode = '22023'; end if;
  insert into public.listings (zone, district, neighborhood, block, area_orig, area_final, facade, view_type, price, paid, inst_left, description, photo_path)
  values (p->>'zone', (p->>'district')::smallint, nullif(p->>'neighborhood','')::smallint, nullif(btrim(coalesce(p->>'block','')),''),
    case when v_ao > 0 then v_ao end, case when v_af > 0 then v_af end, nullif(p->>'facade',''), nullif(p->>'view_type',''),
    round((p->>'price')::numeric, 1), round((p->>'paid')::numeric, 1), (p->>'inst_left')::smallint,
    btrim(coalesce(p->>'description','')), v_photo)
  returning id into v_id;
  update public.listings
    set code = (case zone when 'القادسية' then 'Q' else 'A' end) || to_char(now() at time zone 'Africa/Cairo', 'YYMM') || '-' || id
    where id = v_id returning code into v_code;
  insert into public.listing_private (listing_id, owner_name, phone, plot_number, letter_path)
  values (v_id, btrim(p->>'name'), v_phone, nullif(btrim(coalesce(p->>'plot_number','')),''), v_letter);
  return v_code;
end $$;
revoke execute on function public.submit_offer(jsonb) from public, anon, authenticated;
grant execute on function public.submit_offer(jsonb) to anon, authenticated;

-- Admin listings now include the letter path.
create or replace function public.admin_listings() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query select to_jsonb(l) || jsonb_build_object('owner_name', pr.owner_name, 'phone', pr.phone, 'plot_number', pr.plot_number, 'letter_path', pr.letter_path,
      'request_count', (select count(*) from public.requests r where r.listing_id = l.id))
    from public.listings l left join public.listing_private pr on pr.listing_id = l.id order by l.created_at desc;
end $$;
