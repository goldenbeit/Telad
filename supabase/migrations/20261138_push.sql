-- Phone notifications (Web Push), decided 19/11:
--  * Instantly: a new buyer request, a new seller offer, a new service request (to the sales admin, the web admin and
--    the managers: owner, GM, super admin).
--  * Every 10 minutes, grouped: for each team member, the bell notifications about things that are now in their hands
--    ("وصلك", "رجعلك"); for the managers, everything that happened (the request logs), grouped by who did what.
--  * Every day at 10:00 and 20:00 Cairo time: how many late items each person holds, or "مفيش متأخر عندك 👍".
-- The edge function push-send delivers the outbox (push_out) to the devices in push_subs. Its signing keys are made by
-- the function itself and kept in private.push_keys (never in the code or the chat). pg_cron runs push_tick() every
-- 2 minutes; new requests call the function right away through pg_net.

create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_keys (id int primary key default 1 check (id = 1), public_key text not null, private_key text not null, created_at timestamptz not null default now());

create table if not exists public.push_subs (
  id bigserial primary key, user_id uuid not null, endpoint text not null unique, p256dh text not null, auth text not null,
  created_at timestamptz not null default now(), fails int not null default 0);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

create table if not exists public.push_out (
  id bigserial primary key, user_id uuid not null, title text not null, body text not null default '', url text not null default '/admin',
  tag text, created_at timestamptz not null default now(), sent_at timestamptz);
create index if not exists push_out_unsent_idx on public.push_out (id) where sent_at is null;
alter table public.push_out enable row level security;

create table if not exists public.push_state (k text primary key, at timestamptz not null);
alter table public.push_state enable row level security;
insert into public.push_state (k, at) values ('digest', now()), ('summary', now()) on conflict (k) do nothing;

-- ---------- the device registers / leaves ----------
create or replace function public.push_public_key() returns text language sql stable security definer set search_path = ''
as $$ select public_key from private.push_keys where id = 1 $$;
revoke execute on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public._role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'invalid_subscription' using errcode = '22023'; end if;
  insert into public.push_subs (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, fails = 0;
end $$;
revoke execute on function public.push_subscribe(text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text) returns void language sql security definer set search_path = ''
as $$ delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid() $$;
revoke execute on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;

-- ---------- who is who ----------
-- Every signed-in person with a role: owners (admins) as 'owner', active members with their role.
create or replace function public._push_people() returns table (uid uuid, role text, staff_id bigint) language sql stable security definer set search_path = ''
as $$
  select a.user_id, 'owner', null::bigint from public.admins a
  union all
  select s.user_id, s.role, s.id from public.staff s where s.active and s.user_id is not null
    and s.user_id not in (select user_id from public.admins)
$$;
revoke execute on function public._push_people() from public, anon, authenticated;

-- Does this person hold the request right now (the desk's "عندي", plus the web admin's sold task and the team leader's
-- qualified-lead approval)? Mirrors isMine() in lib/desk-ui.js.
create or replace function public._push_holds(p_role text, p_staff bigint, r public.requests) returns boolean language sql stable set search_path = ''
as $$
  select case
    when r.stage = 'closed' then p_role in ('owner','web','super') and r.web_task
    when r.via = 'ask' then p_role in ('owner','sadmin','super')
    when r.stage = 'new' then p_role in ('owner','sadmin','super')
    when r.stage = 'up_sa' then p_role in ('owner','sadmin','super')
      or (p_role = 'web' and (((r.outcome in ('lost','unfit')) and coalesce(r.cx_action, '') <> 'escalate') or (r.via = 'offer' and r.outcome = 'ready')))
    when r.stage in ('tl','up_tl') then (p_role = 'tl' and (r.tl_id = p_staff or (r.via = 'verify' and r.tl_id is null and r.stage = 'up_tl'))
      and not (r.via = 'verify' and r.stage = 'tl'))
    when r.stage in ('sup','up_sup') then p_role = 'sup' and (r.sup_id = p_staff or (r.batch is not null and r.sup_id is null))
    when r.stage = 'sales' then p_role in ('junior','senior') and r.sales_id = p_staff
    else false end
  or (p_role in ('owner','web','super') and r.web_task)
  or (p_role = 'tl' and r.tl_id = p_staff and r.ql_state = 'asked')
$$;
revoke execute on function public._push_holds(text, bigint, public.requests) from public, anon, authenticated;

-- The deadline the request is running on now (curDue() in lib/desk-ui.js).
create or replace function public._push_due(r public.requests) returns timestamptz language sql stable set search_path = ''
as $$
  select case when r.stage = 'closed' then null
    when r.stage = 'sales' and r.st_due is not null then r.st_due
    else (select g.due_at from public.request_legs g where g.request_id = r.id and g.kind = 't' and g.ended_at is null order by g.id desc limit 1) end
$$;
revoke execute on function public._push_due(public.requests) from public, anon, authenticated;

-- ---------- sending ----------
create or replace function public._push_kick() returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.push_out where sent_at is null) then
    perform net.http_post(url := 'https://xvxwvkxashwizafetltl.supabase.co/functions/v1/push-send',
      body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 20000);
  end if;
end $$;
revoke execute on function public._push_kick() from public, anon, authenticated;

-- Instantly: new buyer request / seller offer / "looking for a plot" request.
create or replace function public._push_new_req() returns trigger language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if new.stage <> 'new' or new.via not in ('form','offer','ask') then return new; end if;
  t := case new.via when 'offer' then 'عرض بائع جديد' when 'ask' then 'طلب جديد: بيدوّر على قطعة' else 'طلب شراء جديد' end;
  insert into public.push_out (user_id, title, body, url, tag)
    select p.uid, t, 'R-' || new.id || ' · ' || public._req_title(new) || coalesce(' · ' || nullif(new.name, ''), ''), '/admin?r=' || new.id, 'new-' || new.id
    from public._push_people() p
    where (p.role in ('owner','sadmin','gm','super') or (p.role = 'web' and new.via <> 'ask'))
      and exists (select 1 from public.push_subs s where s.user_id = p.uid);
  perform public._push_kick();
  return new;
end $$;
drop trigger if exists requests_push_new on public.requests;
create trigger requests_push_new after insert on public.requests for each row execute function public._push_new_req();

-- Instantly: new service request ("حلول تِلاد").
create or replace function public._push_new_svc() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_out (user_id, title, body, url, tag)
    select p.uid, 'طلب خدمة جديد', 'T-' || new.id || coalesce(' · ' || nullif(new.name, ''), ''), '/admin?svc=' || new.id, 'svc-' || new.id
    from public._push_people() p
    where p.role in ('owner','sadmin','web','gm','super') and exists (select 1 from public.push_subs s where s.user_id = p.uid);
  perform public._push_kick();
  return new;
end $$;
drop trigger if exists service_requests_push_new on public.service_requests;
create trigger service_requests_push_new after insert on public.service_requests for each row execute function public._push_new_svc();

-- Every 10 minutes: the grouped notifications.
create or replace function public._push_digest(p_from timestamptz, p_to timestamptz) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- team members (not the managers): bell notifications about what is now in their hands
  insert into public.push_out (user_id, title, body, url, tag)
  select g.uid,
    g.title,
    case when g.n = 1 then g.one_body else g.n || ' مرة · دوس تشوفهم' end,
    case when g.n = 1 and g.one_req is not null then '/admin?r=' || g.one_req else '/admin?bell=1' end,
    'grp-' || md5(g.title)
  from (
    select x.uid, x.title, count(*) n, min(x.rest) one_body, min(x.request_id) one_req
    from (
      select n.user_id uid, n.request_id,
        trim(regexp_replace(regexp_replace(split_part(n.body, ':', 1), '\s*[A-Z]\d{4}-\d+\s*\(R-\d+\)|\s*[A-Z]\d{4}-\d+|\s*R-\d+', '', 'g'), '\s+', ' ', 'g')) title,
        coalesce(substring(n.body from '([A-Z]\d{4}-\d+)'), 'R-' || n.request_id, '') || coalesce(' · ' || nullif(trim(substring(n.body from ':(.*)$')), ''), '') rest
      from public.notifications n
      join public._push_people() p on p.uid = n.user_id and p.role not in ('owner','gm','super')
      left join public.requests r on r.id = n.request_id
      where n.created_at > p_from and n.created_at <= p_to
        and exists (select 1 from public.push_subs s where s.user_id = n.user_id)
        and not (n.request_id is null and n.body like 'طلب خدمة جديد%')
        and not (r.id is not null and r.via in ('form','offer','ask') and n.created_at - r.created_at < interval '1 minute')
        and (n.request_id is null or (r.id is not null and public._push_holds(p.role, p.staff_id, r)))
    ) x group by x.uid, x.title
  ) g;

  -- managers: everything that happened, by who did what
  insert into public.push_out (user_id, title, body, url, tag)
  select m.uid,
    case when count(*) = 1 then min(e.who) || ': ' || min(e.what) || case when sum(e.n) > 1 then ' (' || sum(e.n) || ')' else '' end
      else 'آخر 10 دقايق: ' || sum(e.n) || ' حركة' end,
    case when count(*) = 1 then 'دوس تشوف التفاصيل'
      else string_agg(e.who || ': ' || e.what || case when e.n > 1 then ' (' || e.n || ')' else '' end, ' · ' order by e.n desc) end,
    '/admin', 'mgr-digest'
  from public._push_people() m
  join (
    select coalesce(s.name, 'الأدمن') who, s.user_id actor_uid, ev.by_owner,
      trim(regexp_replace(split_part(ev.body, ':', 1), '\s*\(صف \d+\)', '', 'g')) what, count(*) n
    from public.request_events ev left join public.staff s on s.id = ev.staff_id
    where ev.created_at > p_from and ev.created_at <= p_to and (ev.staff_id is not null or ev.by_owner)
    group by 1, 2, 3, 4
  ) e on not (e.actor_uid is not distinct from m.uid and e.actor_uid is not null) and not (e.by_owner and m.role = 'owner')
  where m.role in ('owner','gm','super') and exists (select 1 from public.push_subs s where s.user_id = m.uid)
  group by m.uid;
end $$;
revoke execute on function public._push_digest(timestamptz, timestamptz) from public, anon, authenticated;

-- 10:00 and 20:00 Cairo: late items each person holds.
create or replace function public._push_summary(p_label text) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_out (user_id, title, body, url, tag)
  select p.uid, p_label,
    case when c.n > 0 then 'عندك ' || c.n || ' متأخر · دوس تشوفهم' else 'مفيش متأخر عندك 👍' end, '/admin', 'late-summary'
  from public._push_people() p
  cross join lateral (
    select count(*) n from public.requests r
    where r.stage <> 'closed' and public._push_due(r) < now()
      and (public._push_holds(p.role, p.staff_id, r) or p.role = 'super')
  ) c
  where exists (select 1 from public.push_subs s where s.user_id = p.uid);
end $$;
revoke execute on function public._push_summary(text) from public, anon, authenticated;

-- Runs every 2 minutes (pg_cron).
create or replace function public.push_tick() returns void language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz; v_now timestamptz := now(); v_cairo timestamp := now() at time zone 'Africa/Cairo'; v_slot timestamp; v_sum timestamptz; h int;
begin
  select at into v_last from public.push_state where k = 'digest' for update;
  if v_now - v_last >= interval '10 minutes' then
    perform public._push_digest(v_last, v_now);
    update public.push_state set at = v_now where k = 'digest';
  end if;

  select at into v_sum from public.push_state where k = 'summary' for update;
  foreach h in array array[10, 20] loop
    v_slot := date_trunc('day', v_cairo) + make_interval(hours => h);
    if v_cairo >= v_slot and v_cairo < v_slot + interval '1 hour' and (v_sum at time zone 'Africa/Cairo') < v_slot then
      perform public._push_summary(case when h = 10 then 'ملخص الصبح' else 'ملخص بالليل' end);
      update public.push_state set at = v_now where k = 'summary';
    end if;
  end loop;

  delete from public.push_out where sent_at < now() - interval '7 days';
  perform public._push_kick();
end $$;
revoke execute on function public.push_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'telad-push-tick';
select cron.schedule('telad-push-tick', '*/2 * * * *', 'select public.push_tick()');

-- (applied as push_lockdown) trigger functions are not callable from the API, and pg_net lives outside public
revoke execute on function public._push_new_req() from public, anon, authenticated;
revoke execute on function public._push_new_svc() from public, anon, authenticated;
revoke execute on function public._touch_listing() from public, anon, authenticated;
revoke execute on function public._touch_request() from public, anon, authenticated;
revoke execute on function public._touch_row() from public, anon, authenticated;
drop extension if exists pg_net;
create extension pg_net with schema extensions;
