-- Verifying the old plots (توثيق، 15/11).
-- Every published plot from before the offers path is "غير موثقة". Each gets a verify request (kind = via = 'verify')
-- that starts at the team leader (no sales admin step). The team leader distributes (one or many at once) to a
-- supervisor (first deadline: a day), the supervisor picks a salesperson, who marks 5 statuses (6 hours each),
-- fixes the data, uploads the photo and the allocation letter, and finishes "sound" or "unsound" (+ reason).
-- Back up through the supervisor to the team leader, who approves: sound -> listings.verified; unsound -> hidden.
-- "موثقة" shows in the desk only, never on the public site. New plots published from now on are verified.

alter table public.listings add column if not exists verified boolean not null default false;
alter table public.listings add column if not exists verified_at timestamptz;

alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('unit','ask','offer','verify'));
alter table public.requests drop constraint if exists requests_via_check;
alter table public.requests add constraint requests_via_check check (via in ('form','wa','ask','offer','verify'));
alter table public.requests drop constraint if exists requests_outcome_check;
alter table public.requests add constraint requests_outcome_check check (outcome in ('sold','deposit','follow','lost','ready','unfit','dropped','sound','unsound'));

create or replace function public._req_via() returns trigger
language plpgsql set search_path = ''
as $$ begin new.via := case when new.kind = 'ask' then 'ask' when new.kind = 'offer' then 'offer' when new.kind = 'verify' then 'verify'
  when new.via = 'wa' then 'wa' else 'form' end; return new; end $$;

create or replace function public._out_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'sold' then 'اتباع' when 'deposit' then 'اتدفع عربون' when 'follow' then 'محتاج متابعة' when 'lost' then 'اتقفل من غير بيع'
  when 'ready' then 'جاهز للنشر' when 'unfit' then 'مش مناسب' when 'dropped' then 'اتشال من المسار'
  when 'sound' then 'سليمة' when 'unsound' then 'مش سليمة' end; $$;

create or replace function public._st_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'call_buyer' then 'تواصلنا مع المشتري' when 'no_answer' then 'المشتري مش بيرد' when 'confirmed' then 'اتأكدنا من الطلب والميزانية'
  when 'call_seller' then 'تواصلنا مع البائع' when 'available' then 'البائع أكّد إن القطعة متاحة' when 'options' then 'بعتنا اختيارات للمشتري'
  when 'visit_set' then 'اتحدد معاد معاينة' when 'visited' then 'المعاينة تمت' when 'nego' then 'بنتفاوض على السعر' when 'deposit' then 'اتدفع عربون'
  when 'contract' then 'اتمضى العقد' when 'later' then 'المشتري طلب نأجّل'
  when 'o_seller' then 'كلّمنا البائع' when 'o_data' then 'اتأكدنا من بيانات القطعة' when 'o_photos' then 'الصورتين واضحين'
  when 'o_price' then 'السعر منطقي ومناسب للحي' when 'o_serious' then 'البائع جاد ومستعد يبيع'
  when 'v_seller' then 'اتواصلنا مع البائع للتوثيق' when 'v_data' then 'البيانات اتأكدت أو اتصلّحت' when 'v_photos' then 'الصورتين اترفعوا'
  when 'v_still' then 'البائع لسه عايز يبيع' when 'v_price' then 'السعر اتأكد' end; $$;

create or replace function public._req_title(r public.requests) returns text
language sql stable security definer set search_path = ''
as $$ select case when r.via = 'ask' then 'طلب بيدوّر على قطعة R-' || r.id
  when r.via = 'offer' then 'عرض ' || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')'
  when r.via = 'verify' then 'توثيق ' || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')'
  else (case when r.via = 'wa' then 'واتساب على ' else 'طلب ' end) || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')' end; $$;

-- a verify request not yet distributed is seen by every team leader; the one who distributes it takes it
create or replace function public._can_see(r public.requests) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(case public._role()
  when 'owner' then true when 'sadmin' then true when 'gm' then true when 'super' then true
  when 'web' then r.via <> 'ask'
  when 'tl' then r.tl_id = (public._me()).id or (r.via = 'verify' and r.tl_id is null)
  when 'sup' then r.sup_id = (public._me()).id
  when 'junior' then r.sales_id = (public._me()).id
  when 'senior' then r.sales_id = (public._me()).id
  else false end, false); $$;

create or replace function public._can_edit_offer(p_listing bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.requests r where r.listing_id = p_listing and r.via in ('offer','verify') and r.stage <> 'closed' and public._can_see(r)
  and (public._role() in ('owner','super','sadmin','web') or (public._role() in ('junior','senior') and r.stage = 'sales' and r.sales_id = (public._me()).id))); $$;
revoke execute on function public._can_edit_offer(bigint) from public, anon, authenticated;

create or replace function public._can_letter(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$ select public._can_plots() or exists (select 1 from public.listing_private pr join public.requests r on r.listing_id = pr.listing_id
  where pr.letter_path = p_name and r.via in ('offer','verify') and r.stage <> 'closed' and public._can_see(r)); $$;

create or replace function public._verify_open(p_listing bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint;
begin
  insert into public.requests (kind, via, listing_id, name, phone, zone, district, stage, tl_mode)
  select 'verify', 'verify', l.id, btrim(pr.owner_name), pr.phone, l.zone, l.district, 'tl', 'confirm'
  from public.listings l join public.listing_private pr on pr.listing_id = l.id
  where l.id = p_listing and l.state = 'approved' and not l.verified
    and char_length(btrim(coalesce(pr.owner_name, ''))) between 2 and 80 and coalesce(pr.phone, '') ~ '^01[0125][0-9]{8}$'
    and not exists (select 1 from public.requests r where r.listing_id = l.id and r.via = 'verify' and r.stage <> 'closed')
  returning id into v_id;
  if v_id is null then return null; end if;
  insert into public.request_legs (request_id, role, due_at) values (v_id, 'tl', now() + interval '1 day');
  insert into public.request_events (request_id, body) values (v_id, 'اتفتح طلب توثيق للقطعة');
  return v_id;
end $$;
revoke execute on function public._verify_open(bigint) from public, anon, authenticated;

-- close an open verify request when the plot changes from the plots tab (sold / hidden / rejected / deleted)
create or replace function public._verify_close(p_listing bigint, p_state text) returns void
language plpgsql security definer set search_path = ''
as $$
declare x record;
begin
  for x in select r.id from public.requests r where r.listing_id = p_listing and r.via = 'verify' and r.stage <> 'closed' loop
    update public.request_legs set ended_at = now() where request_id = x.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(), outcome = 'dropped', outcome_reason = 'القطعة اتغيرت حالتها من تبويب القطع' where id = x.id;
    perform public._event(x.id, case p_state when 'deleted' then 'القطعة اتمسحت' else 'القطعة اتغيرت حالتها من تبويب القطع، فالتوثيق اتقفل' end);
  end loop;
end $$;
revoke execute on function public._verify_close(bigint, text) from public, anon, authenticated;

-- the team leader distributes one or many verify requests to a supervisor
create or replace function public.desk_verify_assign(p_ids bigint[], p_sup bigint, p_mins int, p_note text) returns int
language plpgsql security definer set search_path = ''
as $$
declare v_role text := public._role(); me public.staff := public._me(); v_sup public.staff; r public.requests; n int := 0; last_id bigint;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_role is distinct from 'tl' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_mins is null or p_mins < 5 or p_mins > 10080 then raise exception 'mins_required' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  select * into v_sup from public.staff where id = p_sup and role = 'sup' and active;
  if v_sup.id is null then raise exception 'invalid_sup' using errcode = '22023'; end if;
  for r in select * from public.requests where id = any(p_ids) and via = 'verify' and stage = 'tl' and (tl_id is null or tl_id = me.id) order by id for update loop
    perform public._close_legs(r.id);
    update public.requests set tl_id = me.id, tl_ack = true, sup_id = v_sup.id, stage = 'sup' where id = r.id;
    perform public._leg(r.id, v_sup.id, 'sup', p_mins);
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    perform public._event(r.id, 'وزّعه على ' || v_sup.name);
    n := n + 1; last_id := r.id;
  end loop;
  if n = 0 then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public._notify(public._user_of(v_sup.id), case when n = 1 then last_id end,
    public._actor() || ' بعت لك ' || case when n = 1 then 'قطعة' else n || ' قطع' end || ' للتوثيق');
  return n;
end $$;
revoke execute on function public.desk_verify_assign(bigint[], bigint, int, text) from public, anon;

-- the reviewer (or the plots team) attaches an uploaded photo / allocation letter to a plot
create or replace function public.desk_set_files(p_listing bigint, p_photo text, p_letter text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_photo text := nullif(p_photo, ''); v_letter text := nullif(p_letter, '');
begin
  if not (public._can_plots() or public._can_edit_offer(p_listing)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_photo is null and v_letter is null then raise exception 'invalid_file' using errcode = '22023'; end if;
  if v_photo is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = v_photo and o.name like 'incoming/%') then
    raise exception 'invalid_file' using errcode = '22023'; end if;
  if v_letter is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'allocation-letters' and o.name = v_letter and o.name like 'incoming/%') then
    raise exception 'invalid_file' using errcode = '22023'; end if;
  if v_photo is not null then update public.listings set photo_path = v_photo where id = p_listing; end if;
  if v_letter is not null then update public.listing_private set letter_path = v_letter where listing_id = p_listing; end if;
  if not found then raise exception 'listing_not_found' using errcode = '22023'; end if;
  perform public._event(r.id, case when v_photo is not null and v_letter is not null then 'رفع صورة القطعة وخطاب التخصيص' when v_photo is not null then 'رفع صورة القطعة' else 'رفع خطاب التخصيص' end)
    from public.requests r where r.listing_id = p_listing and r.via in ('offer','verify') and r.stage <> 'closed';
end $$;
revoke execute on function public.desk_set_files(bigint, text, text) from public, anon;

do $m$
declare d text; n int;
begin
  -- edits by the reviewer are logged on open verify requests too
  d := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$r.via = 'offer' and r.stage <> 'closed'$a$, ''))) / length($a$r.via = 'offer' and r.stage <> 'closed'$a$);
  if n <> 1 then raise exception 'admin_update_listing patch matched % times', n; end if;
  execute replace(d, $a$r.via = 'offer' and r.stage <> 'closed'$a$, $b$r.via in ('offer','verify') and r.stage <> 'closed'$b$);

  -- publishing a pending plot makes it verified; leaving 'approved' closes an open verify request
  d := pg_get_functiondef('public.admin_set_state(bigint,text)'::regprocedure);
  n := (length(d) - length(replace(d, $a$update public.listings set state = p_state, reviewed_at = now(),$a$, ''))) / length($a$update public.listings set state = p_state, reviewed_at = now(),$a$);
  if n <> 1 then raise exception 'admin_set_state patch 1 matched % times', n; end if;
  d := replace(d, $a$update public.listings set state = p_state, reviewed_at = now(),$a$,
    $b$update public.listings set state = p_state, reviewed_at = now(),
    verified = verified or (p_state = 'approved' and state = 'pending'), verified_at = case when not verified and p_state = 'approved' and state = 'pending' then now() else verified_at end,$b$);
  n := (length(d) - length(replace(d, $a$  if p_state <> 'pending' then perform public._offer_close(p_id, p_state); end if;$a$, ''))) / length($a$  if p_state <> 'pending' then perform public._offer_close(p_id, p_state); end if;$a$);
  if n <> 1 then raise exception 'admin_set_state patch 2 matched % times', n; end if;
  execute replace(d, $a$  if p_state <> 'pending' then perform public._offer_close(p_id, p_state); end if;$a$,
    $b$  if p_state <> 'pending' then perform public._offer_close(p_id, p_state); end if;
  if p_state <> 'approved' then perform public._verify_close(p_id, p_state); end if;$b$);

  d := pg_get_functiondef('public.admin_delete_listing(bigint)'::regprocedure);
  n := (length(d) - length(replace(d, $a$  perform public._offer_close(p_id, 'deleted');$a$, ''))) / length($a$  perform public._offer_close(p_id, 'deleted');$a$);
  if n <> 1 then raise exception 'admin_delete_listing patch matched % times', n; end if;
  execute replace(d, $a$  perform public._offer_close(p_id, 'deleted');$a$, $b$  perform public._offer_close(p_id, 'deleted');
  perform public._verify_close(p_id, 'deleted');$b$);
end $m$;

create or replace function pg_temp.rep(d text, a text, b text, cnt int) returns text language plpgsql as $f$
declare n int := (length(d) - length(replace(d, a, ''))) / length(a);
begin
  if n <> cnt then raise exception 'desk_act patch matched % times (wanted %): %', n, cnt, left(a, 80); end if;
  return replace(d, a, b);
end $f$;

do $m$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
begin
  -- steps that do not apply to a verify request (distributing goes through desk_verify_assign)
  d := pg_temp.rep(d, $a$  if r.via = 'offer' and a in ('phone','ql_ask','ql_ok','ql_no','webdone') then raise exception 'not_allowed' using errcode = '42501'; end if;
$a$, $a$  if r.via = 'offer' and a in ('phone','ql_ask','ql_ok','ql_no','webdone') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if r.via = 'verify' and (a in ('phone','forward','ack','confirm','ql_ask','ql_ok','ql_no','webdone','cx') or (a = 'up' and r.stage = 'up_tl')) then raise exception 'not_allowed' using errcode = '42501'; end if;
$a$, 1);

  -- each kind has its own statuses
  d := pg_temp.rep(d, $a$    if (r.via = 'offer') <> (k in ('o_seller','o_data','o_photos','o_price','o_serious')) then raise exception 'invalid_status' using errcode = '22023'; end if;$a$,
    $b$    if (case when r.via = 'offer' then k not in ('o_seller','o_data','o_photos','o_price','o_serious')
      when r.via = 'verify' then k not in ('v_seller','v_data','v_photos','v_still','v_price')
      else k in ('o_seller','o_data','o_photos','o_price','o_serious','v_seller','v_data','v_photos','v_still','v_price') end) then
      raise exception 'invalid_status' using errcode = '22023'; end if;$b$, 1);

  -- the reviewer finishes sound / unsound (+ reason)
  d := pg_temp.rep(d, $a$    if v_out in ('lost','unfit') and nullif(btrim(coalesce(p->>'reason','')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;$a$,
    $b$    if v_out in ('lost','unfit','unsound') and nullif(btrim(coalesce(p->>'reason','')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;$b$, 1);
  d := pg_temp.rep(d, $a$    if (r.via = 'offer' and v_out not in ('ready','unfit')) or (r.via <> 'offer' and v_out not in ('sold','lost')) then raise exception 'invalid_outcome' using errcode = '22023'; end if;$a$,
    $b$    if (r.via = 'offer' and v_out not in ('ready','unfit')) or (r.via = 'verify' and v_out not in ('sound','unsound')) or (r.via not in ('offer','verify') and v_out not in ('sold','lost')) then raise exception 'invalid_outcome' using errcode = '22023'; end if;$b$, 1);

  -- a plot published from an offer is verified
  d := pg_temp.rep(d, $a$    update public.listings set state = case when v_out = 'ready' then 'approved' else 'rejected' end, reviewed_at = now(),$a$,
    $b$    update public.listings set state = case when v_out = 'ready' then 'approved' else 'rejected' end, reviewed_at = now(),
      verified = verified or v_out = 'ready', verified_at = case when v_out = 'ready' and not verified then now() else verified_at end,$b$, 1);

  -- the team leader approves the verification at the top
  d := pg_temp.rep(d, $a$  if a = 'close' and r.via = 'offer' then
$a$, $b$  if a = 'close' and r.via = 'verify' then
    if r.stage <> 'up_tl' or not ((v_role = 'tl' and r.tl_id = me.id) or v_role in ('owner','super')) then raise exception 'not_allowed' using errcode = '42501'; end if;
    v_out := coalesce(nullif(p->>'outcome',''), r.outcome);
    if v_out is null or v_out not in ('sound','unsound') then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    k := case when v_out = 'unsound' then coalesce(nullif(btrim(coalesce(p->>'reason','')), ''), r.outcome_reason) end;
    if v_out = 'unsound' and k is null then raise exception 'reason_required' using errcode = '22023'; end if;
    if char_length(coalesce(k, '')) > 200 then raise exception 'note_too_long' using errcode = '22023'; end if;
    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(), outcome = v_out, outcome_reason = k where id = r.id;
    if v_out = 'sound' then update public.listings set verified = true, verified_at = now() where id = r.listing_id;
    else update public.listings set state = 'hidden', reviewed_at = now() where id = r.listing_id and state = 'approved'; end if;
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'note', note); end if;
    perform public._event(r.id, case when v_out = 'sound' then 'اعتمد التوثيق: القطعة موثقة' else 'القطعة مش سليمة واتخفت من الموقع: ' || k end);
    perform public._notify(public._user_of(r.sup_id) || public._user_of(r.sales_id), r.id,
      who || case when v_out = 'sound' then ' اعتمد توثيق ' else ' خفى ' end || t);
    return;
  end if;

  if a = 'close' and r.via = 'offer' then
$b$, 1);
  execute d;
end $m$;

-- the published plots from before today are not verified: open a verify request for each, and tell the team leaders once
do $m$
declare n int := 0; x record;
begin
  for x in select id from public.listings where state = 'approved' and not verified order by id loop
    if public._verify_open(x.id) is not null then n := n + 1; end if;
  end loop;
  if n > 0 then perform public._notify(public._users_of('tl'), null, 'وصلك ' || n || ' قطعة قديمة محتاجة توثيق. وزّعها على المشرفين من تبويب "التوثيق".'); end if;
end $m$;
