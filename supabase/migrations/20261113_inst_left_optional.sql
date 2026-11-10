-- Imported listings may not state how many installments are left.
alter table public.listings alter column inst_left drop not null;
-- admin_update_listing: an empty inst_left is saved as null (applied in the same migration on the project).
-- Only the units imported from the sheet may have no installments count; everything else still needs it.
alter table public.listings add constraint listings_inst_left_required check (inst_left is not null or pay->>'src' = 'sheet');
