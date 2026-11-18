-- Indexes on the foreign keys Supabase's advisor flagged (18/11). Read-only for the data: they only speed up lookups
-- (each member's requests, a request's notifications, who did what) once there are thousands of rows.
-- admins.acting_as is left out: one row, and admins isn't touched without the owner's word.
create index if not exists requests_sales_id_idx on public.requests (sales_id);
create index if not exists requests_sup_id_idx on public.requests (sup_id);
create index if not exists requests_tl_id_idx on public.requests (tl_id);
create index if not exists notifications_request_id_idx on public.notifications (request_id);
create index if not exists request_events_staff_id_idx on public.request_events (staff_id);
create index if not exists request_legs_staff_id_idx on public.request_legs (staff_id);
create index if not exists request_notes_staff_id_idx on public.request_notes (staff_id);
create index if not exists listing_removals_asked_by_idx on public.listing_removals (asked_by);
create index if not exists listing_removals_decided_by_idx on public.listing_removals (decided_by);
create index if not exists service_log_staff_id_idx on public.service_log (staff_id);
