-- Imported listings may not state how many installments are left.
alter table public.listings alter column inst_left drop not null;
-- admin_update_listing: an empty inst_left is saved as null (applied in the same migration on the project).
