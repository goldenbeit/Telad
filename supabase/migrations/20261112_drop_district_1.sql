-- الحي 1 removed from القادسية.
alter table public.listings drop constraint listings_zone_district;
alter table public.listings add constraint listings_zone_district check (
  (allocated and ((zone = 'القادسية' and district = any (array[8, 9, 10, 12, 17, 20, 22, 23]))
               or (zone = 'الأمل' and district = any (array[28, 29, 30, 31, 32, 33, 35, 36]))))
  or (not allocated and district is null));
