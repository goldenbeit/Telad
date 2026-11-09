-- District lists confirmed by the user on 2026-11-09:
-- القادسية: 1, 8, 9, 10, 12, 17, 20, 22, 23 (21 removed, 1 added)
-- الأمل: 28, 29, 30, 31, 32, 33, 35, 36 (34 removed, 31 added)
alter table public.listings drop constraint listings_check1;
alter table public.listings add constraint listings_zone_district check (
  (zone = 'القادسية' and district in (1,8,9,10,12,17,20,22,23)) or (zone = 'الأمل' and district in (28,29,30,31,32,33,35,36)));
