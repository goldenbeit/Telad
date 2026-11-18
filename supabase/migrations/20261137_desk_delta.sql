-- The desk refreshes every minute. It used to download every request and every plot each time; now it asks only for
-- what changed since its last refresh (18/11), plus the list of ids it may still see (so removed ones drop out).
-- touched_at is bumped by triggers on anything the desk shows: the row itself, its legs and notes, the plot's private data.

alter table public.requests add column if not exists touched_at timestamptz not null default now();
alter table public.listings add column if not exists touched_at timestamptz not null default now();
create index if not exists requests_touched_idx on public.requests (touched_at);
create index if not exists listings_touched_idx on public.listings (touched_at);

create or replace function public._touch_row() returns trigger language plpgsql set search_path = '' as $$
begin new.touched_at := now(); return new; end $$;
drop trigger if exists requests_touch on public.requests;
create trigger requests_touch before update on public.requests for each row execute function public._touch_row();
drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings for each row execute function public._touch_row();

-- legs and notes change what a request card shows
create or replace function public._touch_request() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.requests set touched_at = now() where id = case when tg_op = 'DELETE' then old.request_id else new.request_id end;
  return null;
end $$;
drop trigger if exists request_legs_touch on public.request_legs;
create trigger request_legs_touch after insert or update or delete on public.request_legs for each row execute function public._touch_request();
drop trigger if exists request_notes_touch on public.request_notes;
create trigger request_notes_touch after insert or update or delete on public.request_notes for each row execute function public._touch_request();

-- the seller's private data, and the number of requests on a plot, show in the plots tab
create or replace function public._touch_listing() returns trigger language plpgsql security definer set search_path = '' as $$
declare v bigint := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;
begin
  if v is not null then update public.listings set touched_at = now() where id = v; end if;
  return null;
end $$;
drop trigger if exists listing_private_touch on public.listing_private;
create trigger listing_private_touch after insert or update on public.listing_private for each row execute function public._touch_listing();
drop trigger if exists requests_touch_listing on public.requests;
create trigger requests_touch_listing after insert or delete on public.requests for each row execute function public._touch_listing();

-- One request as the desk list shows it (same shape as desk_requests).
create or replace function public._desk_req_json(r public.requests, l public.listings) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('batch', r.batch, 'l_missing', l.missing) || jsonb_build_object('id', r.id, 'via', r.via, 'stage', r.stage, 'name', r.name, 'phone', r.phone, 'listing_id', r.listing_id,
      'zone', r.zone, 'district', r.district, 'budget', r.budget, 'created_at', r.created_at,
      'tl_id', r.tl_id, 'sup_id', r.sup_id, 'sales_id', r.sales_id, 'tl_mode', r.tl_mode, 'tl_ack', r.tl_ack,
      'st_key', r.st_key, 'st_at', r.st_at, 'st_due', r.st_due, 'outcome', r.outcome, 'outcome_reason', r.outcome_reason, 'outcome_summary', r.outcome_summary,
      'first_at', r.first_at, 'closed_at', r.closed_at, 'web_task', r.web_task, 'ql', r.ql_state, 'ql_at', r.ql_at, 'ql_note', r.ql_note, 'cx', r.cx_action, 'cx_until', r.cx_until, 'cx_eval', r.cx_eval, 'cx_count', r.cx_count, 'kind', r.kind, 'client_late', r.client_late,
      'code', l.code, 'l_district', l.district, 'l_zone', l.zone, 'l_area', coalesce(l.area_final, l.area_orig), 'l_price', l.price, 'l_paid', l.paid, 'l_over', l.over_range,
      'notes', (select count(*) from public.request_notes n where n.request_id = r.id),
      'legs', coalesce((select jsonb_agg(jsonb_build_object('staff_id', g.staff_id, 'role', g.role, 'kind', g.kind, 'label', g.label, 'start', g.started_at, 'due', g.due_at, 'end', g.ended_at) order by g.id)
        from public.request_legs g where g.request_id = r.id), '[]'::jsonb))
$$;
revoke execute on function public._desk_req_json(public.requests, public.listings) from public, anon, authenticated;

-- p_since null = everything. Returns { now, ids: every request the caller may see, rows: the ones changed since p_since }.
create or replace function public.desk_requests_since(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ids jsonb; v_rows jsonb;
begin
  if public._role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(r.id), '[]'::jsonb),
         coalesce(jsonb_agg(public._desk_req_json(r, l) order by r.created_at desc)
           filter (where p_since is null or r.touched_at > p_since or l.touched_at > p_since), '[]'::jsonb)
    into v_ids, v_rows
    from public.requests r left join public.listings l on l.id = r.listing_id
   where public._can_see(r);
  return jsonb_build_object('now', now(), 'ids', v_ids, 'rows', v_rows);
end $$;
revoke execute on function public.desk_requests_since(timestamptz) from public, anon;
grant execute on function public.desk_requests_since(timestamptz) to authenticated;

-- Same for the plots tab (same shape as admin_listings).
create or replace function public.admin_listings_since(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ids jsonb; v_rows jsonb;
begin
  if not public._can_plots() then raise exception 'not_admin' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(l.id), '[]'::jsonb),
         coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('owner_name', pr.owner_name, 'phone', pr.phone, 'plot_number', pr.plot_number, 'phone2', pr.phone2,
             'uploader', (select s.name from public.staff s where s.phone = pr.phone2 limit 1), 'letter_path', pr.letter_path,
             'pm', public._listing_pm(l), 'request_count', (select count(*) from public.requests r where r.listing_id = l.id)) order by l.created_at desc)
           filter (where p_since is null or l.touched_at > p_since), '[]'::jsonb)
    into v_ids, v_rows
    from public.listings l left join public.listing_private pr on pr.listing_id = l.id;
  return jsonb_build_object('now', now(), 'ids', v_ids, 'rows', v_rows);
end $$;
revoke execute on function public.admin_listings_since(timestamptz) from public, anon;
grant execute on function public.admin_listings_since(timestamptz) to authenticated;
