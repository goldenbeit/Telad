-- Plot photos are for the team only (18/11): the bucket stops being public, so the site can't show them and a link
-- can't be opened from outside. Anyone on the team (the owner or an active member) gets short-lived links in the desk.
-- Uploads from the seller form and the desk keep working (the insert policy is unchanged).
update storage.buckets set public = false where id = 'listing-photos';

create or replace function public._is_team() returns boolean language sql stable security definer set search_path = ''
as $$ select public._role() is not null $$;
revoke execute on function public._is_team() from public, anon;
grant execute on function public._is_team() to authenticated;

drop policy if exists "team reads plot photos" on storage.objects;
create policy "team reads plot photos" on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and public._is_team());
