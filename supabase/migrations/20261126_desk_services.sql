-- "الخدمات" in the desk (15/11): requests from "حلول تِلاد" show in their own tab.
-- Who: the owner, GM, super admin, sales admin and web admin (not the team leader or below). All of them can do everything:
-- change the state (new / contacted / closed), write notes, and delete for good. No chain, no deadlines.

create table if not exists public.service_log (
  id bigserial primary key,
  service_id bigint not null references public.service_requests(id) on delete cascade,
  staff_id bigint references public.staff(id) on delete set null,
  by_owner boolean not null default false,
  kind text not null default 'event' check (kind in ('event','note')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.service_log enable row level security;
create index if not exists service_log_service on public.service_log (service_id);

create or replace function public._can_services() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public._role() in ('owner','gm','super','sadmin','web'), false); $$;

create or replace function public._svc_log(p_id bigint, p_kind text, p_body text) returns void
language sql security definer set search_path = ''
as $$ insert into public.service_log (service_id, staff_id, by_owner, kind, body)
  values (p_id, (public._me()).id, public.is_admin() and public._acting() is null, p_kind, p_body); $$;

create or replace function public._svc_users() returns uuid[]
language sql stable security definer set search_path = ''
as $$ select public._users_of('sadmin') || public._users_of('web') || public._users_of('gm'); $$;

-- a new service request rings the bell of everyone who handles services
create or replace function public._svc_new() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.service_log (service_id, body) values (new.id, 'وصل طلب خدمة من الموقع');
  perform public._notify(public._svc_users(), null, 'طلب خدمة جديد T-' || new.id || ' من ' || new.name);
  return new;
end $$;
create or replace trigger service_requests_new after insert on public.service_requests for each row execute function public._svc_new();

create or replace function public.desk_services() returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._can_services() then return; end if;
  return query select to_jsonb(s) || jsonb_build_object('notes', (select count(*) from public.service_log g where g.service_id = s.id and g.kind = 'note'))
    from public.service_requests s order by s.created_at desc;
end $$;

create or replace function public.desk_service(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._can_services() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object('log', coalesce((select jsonb_agg(jsonb_build_object('who', case when g.by_owner then 'الأدمن' else st.name end, 'role', st.role,
      'kind', g.kind, 'body', g.body, 'at', g.created_at) order by g.id desc)
    from public.service_log g left join public.staff st on st.id = g.staff_id where g.service_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.desk_service_act(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare s public.service_requests; a text := p->>'a'; v text := p->>'state'; note text := nullif(btrim(coalesce(p->>'note', '')), '');
begin
  if not public._can_services() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into s from public.service_requests where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if note is not null and char_length(note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  if a = 'state' then
    if v not in ('new','contacted','closed') then raise exception 'invalid_action' using errcode = '22023'; end if;
    if v = s.state then return; end if;
    update public.service_requests set state = v where id = p_id;
    perform public._svc_log(p_id, 'event', case v when 'new' then 'رجّعه جديد' when 'contacted' then 'اتكلمنا مع العميل' else 'قفل الطلب' end);
    if note is not null then perform public._svc_log(p_id, 'note', note); end if;
  elsif a = 'note' then
    if note is null then raise exception 'note_required' using errcode = '22023'; end if;
    perform public._svc_log(p_id, 'note', note);
    perform public._notify(public._svc_users(), null, public._actor() || ' كتب ملاحظة على T-' || p_id || ': ' || left(note, 120));
  else raise exception 'invalid_action' using errcode = '22023'; end if;
end $$;

create or replace function public.desk_service_delete(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._can_services() then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.service_requests where id = p_id;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
end $$;

revoke execute on function public._can_services() from public, anon, authenticated;
revoke execute on function public._svc_log(bigint, text, text) from public, anon, authenticated;
revoke execute on function public._svc_users() from public, anon, authenticated;
revoke execute on function public._svc_new() from public, anon, authenticated;
revoke execute on function public.desk_services() from public, anon;
revoke execute on function public.desk_service(bigint) from public, anon;
revoke execute on function public.desk_service_act(bigint, jsonb) from public, anon;
revoke execute on function public.desk_service_delete(bigint) from public, anon;
