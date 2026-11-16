-- 16/11
-- 1) Every published, unverified plot (the 90 old ones) is taken off the site until it is verified (listings.verify_hold).
--    When the team leader approves "تمام" on its verification, the plot goes back on the site by itself.
-- 2) "رقم هاتف تاني (اختياري)" on the seller form (listing_private.phone2). A salesperson helping a seller puts their own
--    number there; the desk shows "رفعها: <name>" when the number belongs to a team member.

alter table public.listings add column if not exists verify_hold boolean not null default false;
alter table public.listing_private add column if not exists phone2 text;
alter table public.listing_private drop constraint if exists listing_private_phone2_check;
alter table public.listing_private add constraint listing_private_phone2_check check (phone2 is null or phone2 ~ '^01[0125][0-9]{8}$');

create or replace function pg_temp.rep(d text, a text, b text, cnt int) returns text language plpgsql as $f$
declare n int := (length(d) - length(replace(d, a, ''))) / length(a);
begin
  if n <> cnt then raise exception 'patch matched % times (wanted %): %', n, cnt, left(a, 80); end if;
  return replace(d, a, b);
end $f$;

do $m$
declare d text;
begin
  -- approving "تمام" puts a held plot back on the site
  d := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  execute pg_temp.rep(d, $a$    if v_out = 'sound' then update public.listings set verified = true, verified_at = now() where id = r.listing_id;$a$,
    $b$    if v_out = 'sound' then update public.listings set verified = true, verified_at = now(),
      state = case when verify_hold and state = 'hidden' then 'approved' else state end,
      published_at = case when verify_hold and state = 'hidden' then coalesce(published_at, now()) else published_at end,
      verify_hold = false where id = r.listing_id;$b$, 1);

  -- "القطعة اتباعت" also works on a held plot
  d := pg_get_functiondef('public.desk_plot_sold(bigint)'::regprocedure);
  execute pg_temp.rep(d, $a$update public.listings set state = 'sold', reviewed_at = now() where id = r.listing_id and state in ('approved','pending') returning * into l;$a$,
    $b$update public.listings set state = 'sold', reviewed_at = now(), verify_hold = false where id = r.listing_id and (state in ('approved','pending') or (state = 'hidden' and verify_hold)) returning * into l;$b$, 1);

  -- changing the state by hand from the plots tab ends the hold
  d := pg_get_functiondef('public.admin_set_state(bigint,text)'::regprocedure);
  execute pg_temp.rep(d, $a$update public.listings set state = p_state, reviewed_at = now(),$a$, $b$update public.listings set state = p_state, reviewed_at = now(), verify_hold = false,$b$, 1);

  -- second phone on the seller form
  d := pg_get_functiondef('public.submit_offer(jsonb)'::regprocedure);
  d := pg_temp.rep(d, $a$  if char_length(btrim(coalesce(p->>'name',''))) not between 2 and 80$a$,
    $b$  if nullif(p->>'phone2','') is not null and p->>'phone2' !~ '^01[0125][0-9]{8}$' then raise exception 'invalid_phone2' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p->>'name',''))) not between 2 and 80$b$, 1);
  d := pg_temp.rep(d, $a$insert into public.listing_private (listing_id, owner_name, phone, plot_number, letter_path)
  values (v_id, btrim(p->>'name'), v_phone, $a$, $b$insert into public.listing_private (listing_id, owner_name, phone, phone2, plot_number, letter_path)
  values (v_id, btrim(p->>'name'), v_phone, nullif(p->>'phone2',''), $b$, 1);
  execute d;

  d := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure);
  execute pg_temp.rep(d, $a$update public.listing_private set owner_name = btrim(p->>'name'), phone = p->>'phone',$a$,
    $b$update public.listing_private set owner_name = btrim(p->>'name'), phone = p->>'phone',
    phone2 = case when p ? 'phone2' then nullif(p->>'phone2','') else phone2 end,$b$, 1);

  -- the desk sees the second phone and, when it is a team member's, their name
  d := pg_get_functiondef('public.desk_request(bigint)'::regprocedure);
  execute pg_temp.rep(d, $a$'owner_name', pr.owner_name, 'owner_phone', pr.phone,$a$,
    $b$'owner_name', pr.owner_name, 'owner_phone', pr.phone, 'phone2', pr.phone2, 'uploader', (select s.name from public.staff s where s.phone = pr.phone2 limit 1), 'verify_hold', l.verify_hold,$b$, 1);
  d := pg_get_functiondef('public.admin_listings()'::regprocedure);
  execute pg_temp.rep(d, $a$'plot_number', pr.plot_number,$a$,
    $b$'plot_number', pr.plot_number, 'phone2', pr.phone2, 'uploader', (select s.name from public.staff s where s.phone = pr.phone2 limit 1),$b$, 1);
end $m$;

-- take the old unverified plots off the site until they are verified
update public.listings set state = 'hidden', verify_hold = true, reviewed_at = now() where state = 'approved' and not verified;
