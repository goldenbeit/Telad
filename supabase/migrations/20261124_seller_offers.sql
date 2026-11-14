-- Seller offers in the desk (مسار عرض البائع).
-- An offer is a row in requests with kind = via = 'offer' pointing at the pending listing, so it walks the same chain
-- as a buyer request: sales admin + web admin -> (team leader) -> supervisor -> a member who reviews it -> back up.
--  * review statuses (5, two hours each): o_seller, o_data, o_photos, o_price, o_serious
--  * the reviewer finishes with ready ('ready', جاهز للنشر) or unfit ('unfit', مش مناسب + a reason)
--  * unfit goes through the supervisor's action exactly like a cancelled sale (cx)
--  * at the top the sales admin or the web admin publishes it (listing -> approved) or confirms the rejection (-> rejected)
--  * the listings dashboard still publishes / rejects directly; that closes the open offer
-- Also: "العميل اتأخر في الرد" (a = 'late') for the salesperson / reviewer inside the deadline: logged, +2 hours,
-- counted on the client in the reports (requests.client_late).

alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('unit','ask','offer'));
alter table public.requests drop constraint if exists requests_via_check;
alter table public.requests add constraint requests_via_check check (via in ('form','wa','ask','offer'));
alter table public.requests drop constraint if exists requests_outcome_check;
alter table public.requests add constraint requests_outcome_check check (outcome in ('sold','deposit','follow','lost','ready','unfit'));
alter table public.requests add column if not exists client_late integer not null default 0;

-- the via of a new row follows its kind (an offer stays 'offer')
create or replace function public._req_via() returns trigger
language plpgsql set search_path = ''
as $$ begin new.via := case when new.kind = 'ask' then 'ask' when new.kind = 'offer' then 'offer' when new.via = 'wa' then 'wa' else 'form' end; return new; end $$;

create or replace function public._out_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'sold' then 'اتباع' when 'deposit' then 'اتدفع عربون' when 'follow' then 'محتاج متابعة' when 'lost' then 'اتقفل من غير بيع'
  when 'ready' then 'جاهز للنشر' when 'unfit' then 'مش مناسب' end; $$;

create or replace function public._st_label(k text) returns text
language sql immutable set search_path = ''
as $$ select case k when 'call_buyer' then 'تواصلنا مع المشتري' when 'no_answer' then 'المشتري مش بيرد' when 'confirmed' then 'اتأكدنا من الطلب والميزانية'
  when 'call_seller' then 'تواصلنا مع البائع' when 'available' then 'البائع أكّد إن القطعة متاحة' when 'options' then 'بعتنا اختيارات للمشتري'
  when 'visit_set' then 'اتحدد معاد معاينة' when 'visited' then 'المعاينة تمت' when 'nego' then 'بنتفاوض على السعر' when 'deposit' then 'اتدفع عربون'
  when 'contract' then 'اتمضى العقد' when 'later' then 'المشتري طلب نأجّل'
  when 'o_seller' then 'كلّمنا البائع' when 'o_data' then 'اتأكدنا من بيانات القطعة' when 'o_photos' then 'الصورتين واضحين'
  when 'o_price' then 'السعر منطقي ومناسب للحي' when 'o_serious' then 'البائع جاد ومستعد يبيع' end; $$;

create or replace function public._req_title(r public.requests) returns text
language sql stable security definer set search_path = ''
as $$ select case when r.via = 'ask' then 'طلب بيدوّر على قطعة R-' || r.id
  when r.via = 'offer' then 'عرض ' || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')'
  else (case when r.via = 'wa' then 'واتساب على ' else 'طلب ' end) || coalesce((select l.code from public.listings l where l.id = r.listing_id), 'قطعة') || ' (R-' || r.id || ')' end; $$;

create or replace function public._req_new() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.stage <> 'new' then return new; end if;
  insert into public.request_legs (request_id, role, due_at) values (new.id, 'sadmin', now() + interval '60 minutes');
  insert into public.request_events (request_id, body) values (new.id,
    case new.via when 'wa' then 'عميل داس واتساب على القطعة' when 'ask' then 'وصل طلب "بيدوّر على قطعة" من الموقع'
      when 'offer' then 'وصل عرض جديد من بائع' else 'وصل طلب "اطلبها" من صفحة القطعة' end);
  perform public._notify(public._users_of('sadmin') || case when new.via = 'ask' then '{}'::uuid[] else public._users_of('web') end, new.id,
    case new.via when 'wa' then 'عميل كلّمنا واتساب: ' when 'offer' then 'عرض جديد: ' else 'طلب جديد: ' end || public._req_title(new));
  return new;
end $$;

-- open an offer for a pending listing (used by submit_offer and for the offers already waiting)
create or replace function public._offer_open(p_listing bigint) returns void
language sql security definer set search_path = ''
as $$ insert into public.requests (kind, via, listing_id, name, phone, zone, district)
  select 'offer', 'offer', l.id, btrim(pr.owner_name), pr.phone, l.zone, l.district
  from public.listings l join public.listing_private pr on pr.listing_id = l.id
  where l.id = p_listing and l.state = 'pending'
    and char_length(btrim(coalesce(pr.owner_name, ''))) between 2 and 80 and coalesce(pr.phone, '') ~ '^01[0125][0-9]{8}$'
    and not exists (select 1 from public.requests r where r.listing_id = l.id and r.via = 'offer' and r.stage <> 'closed'); $$;

-- close the open offer on a listing when the listings dashboard decides (publish / reject / hide / sold / delete)
create or replace function public._offer_close(p_listing bigint, p_state text) returns void
language plpgsql security definer set search_path = ''
as $$
declare x record;
begin
  for x in select r.id from public.requests r where r.listing_id = p_listing and r.via = 'offer' and r.stage <> 'closed' loop
    update public.request_legs set ended_at = now() where request_id = x.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(),
      outcome = case when p_state = 'approved' then 'ready' else 'unfit' end,
      outcome_reason = case when p_state = 'approved' then null else coalesce(outcome_reason, 'من لوحة الإعلانات') end
      where id = x.id;
    perform public._event(x.id, case p_state when 'approved' then 'اتنشر من لوحة الإعلانات' when 'rejected' then 'اترفض من لوحة الإعلانات'
      when 'deleted' then 'الإعلان اتمسح' else 'اتقفل من لوحة الإعلانات' end);
  end loop;
end $$;

-- members who hold an open offer can open its allocation letter
create or replace function public._can_letter(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$ select public._can_listings() or exists (select 1 from public.listing_private pr join public.requests r on r.listing_id = pr.listing_id
  where pr.letter_path = p_name and r.via = 'offer' and r.stage <> 'closed' and public._can_see(r)); $$;

drop policy if exists "desk reads offer letters" on storage.objects;
create policy "desk reads offer letters" on storage.objects for select to authenticated
  using (bucket_id = 'allocation-letters' and public._can_letter(name));

-- who may fix the plot data of an open offer: the reviewer while it is with him, and the admins above
create or replace function public._can_edit_offer(p_listing bigint) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.requests r where r.listing_id = p_listing and r.via = 'offer' and r.stage <> 'closed' and public._can_see(r)
  and (public._role() in ('owner','super','sadmin','web') or (public._role() in ('junior','senior') and r.stage = 'sales' and r.sales_id = (public._me()).id))); $$;

do $m$
declare d text; n int;
begin
  -- submit_offer: every new offer enters the desk
  d := pg_get_functiondef('public.submit_offer(jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$  return v_code;$a$, ''))) / length($a$  return v_code;$a$);
  if n <> 1 then raise exception 'submit_offer patch matched % times', n; end if;
  execute replace(d, $a$  return v_code;$a$, $b$  perform public._offer_open(v_id);
  return v_code;$b$);

  -- listings dashboard decisions close the open offer
  d := pg_get_functiondef('public.admin_set_state(bigint,text)'::regprocedure);
  n := (length(d) - length(replace(d, $a$  return v_code;$a$, ''))) / length($a$  return v_code;$a$);
  if n <> 1 then raise exception 'admin_set_state patch matched % times', n; end if;
  execute replace(d, $a$  return v_code;$a$, $b$  if p_state <> 'pending' then perform public._offer_close(p_id, p_state); end if;
  return v_code;$b$);

  d := pg_get_functiondef('public.admin_delete_listing(bigint)'::regprocedure);
  n := (length(d) - length(replace(d, $a$  delete from public.listings where id = p_id;$a$, ''))) / length($a$  delete from public.listings where id = p_id;$a$);
  if n <> 1 then raise exception 'admin_delete_listing patch matched % times', n; end if;
  execute replace(d, $a$  delete from public.listings where id = p_id;$a$, $b$  perform public._offer_close(p_id, 'deleted');
  delete from public.listings where id = p_id;$b$);

  -- the reviewer and the admins above can fix the plot data of an open offer; the change is logged on the offer
  d := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$if not public._can_listings() then$a$, ''))) / length($a$if not public._can_listings() then$a$);
  if n <> 1 then raise exception 'admin_update_listing patch 1 matched % times', n; end if;
  d := replace(d, $a$if not public._can_listings() then$a$, $a$if not (public._can_listings() or public._can_edit_offer(p_id)) then$a$);
  n := (length(d) - length(replace(d, $a$  where listing_id = p_id;
end$a$, ''))) / length($a$  where listing_id = p_id;
end$a$);
  if n <> 1 then raise exception 'admin_update_listing patch 2 matched % times', n; end if;
  execute replace(d, $a$  where listing_id = p_id;
end$a$, $b$  where listing_id = p_id;
  perform public._event(r.id, 'صلّح بيانات القطعة') from public.requests r where r.listing_id = p_id and r.via = 'offer' and r.stage <> 'closed';
end$b$);

  -- desk_request: the letter path for an open offer (the storage policy decides who can open it)
  d := pg_get_functiondef('public.desk_request(bigint)'::regprocedure);
  n := (length(d) - length(replace(d, $a$'owner_name', pr.owner_name, 'owner_phone', pr.phone)$a$, ''))) / length($a$'owner_name', pr.owner_name, 'owner_phone', pr.phone)$a$);
  if n <> 1 then raise exception 'desk_request patch matched % times', n; end if;
  execute replace(d, $a$'owner_name', pr.owner_name, 'owner_phone', pr.phone)$a$,
    $b$'owner_name', pr.owner_name, 'owner_phone', pr.phone, 'letter_path', case when r.via = 'offer' then pr.letter_path end)$b$);

  -- desk_requests: kind and the client-late count
  d := pg_get_functiondef('public.desk_requests()'::regprocedure);
  n := (length(d) - length(replace(d, $a$'cx_count', r.cx_count,$a$, ''))) / length($a$'cx_count', r.cx_count,$a$);
  if n <> 1 then raise exception 'desk_requests patch matched % times', n; end if;
  execute replace(d, $a$'cx_count', r.cx_count,$a$, $b$'cx_count', r.cx_count, 'kind', r.kind, 'client_late', r.client_late,$b$);
end $m$;

-- desk_act: offers walk the same chain. Every replace must match the exact number of times, or nothing is applied.
create or replace function pg_temp.rep(d text, a text, b text, cnt int) returns text language plpgsql as $f$
declare n int := (length(d) - length(replace(d, a, ''))) / length(a);
begin
  if n <> cnt then raise exception 'desk_act patch matched % times (wanted %): %', n, cnt, left(a, 80); end if;
  return replace(d, a, b);
end $f$;

do $m$
declare d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
begin
  -- steps that do not apply to an offer
  d := pg_temp.rep(d, $a$  t := public._req_title(r);
$a$, $b$  t := public._req_title(r);
  if r.via = 'offer' and a in ('phone','ql_ask','ql_ok','ql_no','webdone') then raise exception 'not_allowed' using errcode = '42501'; end if;
$b$, 1);

  -- review statuses for offers, sale statuses for buyer requests
  d := pg_temp.rep(d, $a$    if public._st_label(k) is null then raise exception 'invalid_status' using errcode = '22023'; end if;
$a$, $b$    if public._st_label(k) is null then raise exception 'invalid_status' using errcode = '22023'; end if;
    if (r.via = 'offer') <> (k in ('o_seller','o_data','o_photos','o_price','o_serious')) then raise exception 'invalid_status' using errcode = '22023'; end if;
$b$, 1);

  -- the reviewer finishes with ready / unfit (+ reason)
  d := pg_temp.rep(d, $a$    if v_out = 'lost' and nullif(btrim(coalesce(p->>'reason','')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
    if v_out not in ('sold','lost') then raise exception 'invalid_outcome' using errcode = '22023'; end if;$a$,
  $b$    if v_out in ('lost','unfit') and nullif(btrim(coalesce(p->>'reason','')), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
    if char_length(coalesce(p->>'reason','')) > 200 then raise exception 'note_too_long' using errcode = '22023'; end if;
    if (r.via = 'offer' and v_out not in ('ready','unfit')) or (r.via <> 'offer' and v_out not in ('sold','lost')) then raise exception 'invalid_outcome' using errcode = '22023'; end if;$b$, 1);

  -- an unfit offer is handled like a cancelled sale on the way up
  d := pg_temp.rep(d, $a$r.outcome = 'lost'$a$, $b$r.outcome in ('lost','unfit')$b$, 7);
  d := pg_temp.rep(d, $a$r.outcome is distinct from 'lost'$a$, $b$coalesce(r.outcome, '') not in ('lost','unfit')$b$, 1);
  -- a ready offer reaches the web admin too (he can publish it)
  d := pg_temp.rep(d, $a$case when r.outcome in ('lost','unfit') and r.cx_action is distinct from 'escalate' then public._users_of('web')$a$,
    $b$case when (r.outcome in ('lost','unfit') and r.cx_action is distinct from 'escalate') or r.outcome = 'ready' then public._users_of('web')$b$, 2);
  d := pg_temp.rep(d, $a$' · البيعة اتلغت، مستني اعتماد الإلغاء'$a$,
    $b$(case when r.via = 'offer' and r.outcome = 'ready' then ' · جاهز للنشر' when r.via = 'offer' then ' · العرض مش مناسب، مستني اعتماد الرفض' else ' · البيعة اتلغت، مستني اعتماد الإلغاء' end)$b$, 2);
  d := pg_temp.rep(d, $a$(v_role = 'web' and r.outcome in ('lost','unfit') and r.cx_action is distinct from 'escalate')$a$,
    $b$(v_role = 'web' and ((r.outcome in ('lost','unfit') and r.cx_action is distinct from 'escalate') or (r.via = 'offer' and r.outcome = 'ready')))$b$, 2);
  d := pg_temp.rep(d, $a$'البيعة اتلغت · $a$, $b$(case when r.via = 'offer' then 'العرض مش مناسب · ' else 'البيعة اتلغت · ' end) || '$b$, 3);
  d := pg_temp.rep(d, $a$' بعت لك إلغاء '$a$, $b$(case when r.via = 'offer' then ' بعت لك رفض ' else ' بعت لك إلغاء ' end)$b$, 2);

  -- closing an offer at the top: publish it, or confirm the rejection
  d := pg_temp.rep(d, $a$  if a = 'close' then
$a$, $b$  if a = 'close' and r.via = 'offer' then
    if not (r.stage = 'up_sa' and (v_role in ('owner','super','sadmin') or (v_role = 'web' and r.cx_action is distinct from 'escalate'))) then
      raise exception 'not_allowed' using errcode = '42501'; end if;
    v_out := coalesce(nullif(p->>'outcome',''), r.outcome);
    if v_out is null or v_out not in ('ready','unfit') then raise exception 'invalid_outcome' using errcode = '22023'; end if;
    k := case when v_out = 'unfit' then coalesce(nullif(btrim(coalesce(p->>'reason','')), ''), r.outcome_reason) end;
    if v_out = 'unfit' and k is null then raise exception 'reason_required' using errcode = '22023'; end if;
    if char_length(coalesce(k, '')) > 200 then raise exception 'note_too_long' using errcode = '22023'; end if;
    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;
    update public.requests set stage = 'closed', state = 'closed', closed_at = now(), outcome = v_out, outcome_reason = k where id = r.id;
    update public.listings set state = case when v_out = 'ready' then 'approved' else 'rejected' end, reviewed_at = now(),
      published_at = case when v_out = 'ready' then coalesce(published_at, now()) else published_at end
      where id = r.listing_id and state = 'pending';
    if note is not null then insert into public.request_notes (request_id, staff_id, by_owner, kind, body) values (r.id, me.id, v_role = 'owner', 'note', note); end if;
    perform public._event(r.id, case when v_out = 'ready' then 'نشر العرض على الموقع' else 'اعتمد رفض العرض: ' || k end);
    perform public._notify(public._user_of(r.tl_id) || public._user_of(r.sup_id) || public._user_of(r.sales_id) || public._users_of('gm'), r.id,
      who || case when v_out = 'ready' then ' نشر ' else ' رفض ' end || t);
    return;
  end if;

  if a = 'close' then
$b$, 1);

  -- the client was late answering: logged, two more hours, counted on the client
  d := pg_temp.rep(d, $a$  if a = 'webdone' then$a$, $b$  if a = 'late' then
    if v_role not in ('junior','senior') or r.stage <> 'sales' or r.sales_id is distinct from me.id then raise exception 'not_allowed' using errcode = '42501'; end if;
    if coalesce(r.st_due, (select max(g.due_at) from public.request_legs g where g.request_id = r.id and g.kind = 't' and g.ended_at is null)) <= now() then
      raise exception 'too_late' using errcode = '22023'; end if;
    update public.request_legs set due_at = due_at + interval '120 minutes' where request_id = r.id and ended_at is null and due_at is not null;
    update public.requests set st_due = st_due + interval '120 minutes', client_late = client_late + 1 where id = r.id;
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'note', note); end if;
    perform public._event(r.id, (case when r.via = 'offer' then 'البائع' else 'العميل' end) || ' اتأخر في الرد · المهلة اتمدّت ساعتين' || coalesce(': ' || left(note, 200), ''));
    if r.sup_id is not null then perform public._notify(public._user_of(r.sup_id), r.id, who || ' سجّل إن ' || (case when r.via = 'offer' then 'البائع' else 'العميل' end) || ' اتأخر في الرد في ' || t); end if;
    return;
  end if;

  if a = 'webdone' then$b$, 1);

  execute d;
end $m$;

-- offers already waiting in the listings dashboard enter the desk
select public._offer_open(l.id) from public.listings l where l.state = 'pending';

-- the offer helpers are internal: only the database functions call them (applied as seller_offers_grants)
revoke execute on function public._offer_open(bigint) from public, anon, authenticated;
revoke execute on function public._offer_close(bigint, text) from public, anon, authenticated;
revoke execute on function public._can_edit_offer(bigint) from public, anon, authenticated;
-- the storage policy checks letters as the signed-in member, so only signed-in members keep this one
revoke execute on function public._can_letter(text) from public, anon;
