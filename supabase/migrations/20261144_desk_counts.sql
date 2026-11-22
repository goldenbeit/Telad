-- A few plain numbers at the top of the reports tab for the team leader and above (22/11): plots on the site, seller
-- offers in review, plots being verified, plots waiting for a price decision, open buyer requests, sold this month.
create or replace function public.desk_counts() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'listed', (select count(*) from public.listings where state = 'approved'),
    'offers', (select count(*) from public.requests where via = 'offer' and stage <> 'closed'),
    'verify', (select count(*) from public.requests where via = 'verify' and stage <> 'closed'),
    'review', (select count(*) from public.listings where price_hold),
    'buyers', (select count(*) from public.requests where via not in ('offer','verify') and stage <> 'closed'),
    'sold_month', (select count(*) from public.requests where via not in ('offer','verify') and outcome = 'sold'
      and closed_at >= (date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo')));
end $$;
revoke execute on function public.desk_counts() from public, anon;
grant execute on function public.desk_counts() to authenticated;
