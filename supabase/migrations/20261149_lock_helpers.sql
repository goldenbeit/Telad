-- Close 4 small helper functions that visitors could call directly (24/11, security advisor).
-- They are only used inside security definer functions (which run as the owner, so they keep working)
-- and in one storage policy (_can_listings, allocation letters), which now applies to signed-in users only.
revoke execute on function public._acting(), public._can_listings(), public._mgr_blocked(text, text), public._viewer_uid() from public, anon;
revoke execute on function public._acting(), public._mgr_blocked(text, text), public._viewer_uid() from authenticated;
grant execute on function public._can_listings() to authenticated;

alter policy "admins read allocation letters" on storage.objects to authenticated;
