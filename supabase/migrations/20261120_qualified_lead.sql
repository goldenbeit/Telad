-- Qualified lead: after the first contact with the buyer, the salesperson asks the team leader to approve
-- the request as a qualified lead. The team leader approves it or says it is not qualified (with a reason).
-- This runs beside the request's path: the request does not move.

alter table public.requests
  add column if not exists ql_state text check (ql_state in ('asked','yes','no')),
  add column if not exists ql_at timestamptz,
  add column if not exists ql_note text check (char_length(ql_note) <= 1000);

do $patch$
declare
  d text; n int;
begin
  -- desk_requests returns the qualified-lead fields
  d := pg_get_functiondef('public.desk_requests()'::regprocedure);
  n := (length(d) - length(replace(d, $a$'web_task', r.web_task,$a$, ''))) / length($a$'web_task', r.web_task,$a$);
  if n <> 1 then raise exception 'desk_requests patch matched % times', n; end if;
  d := replace(d, $a$'web_task', r.web_task,$a$, $b$'web_task', r.web_task, 'ql', r.ql_state, 'ql_at', r.ql_at, 'ql_note', r.ql_note,$b$);
  execute d;

  -- desk_act: ask / approve / reject
  d := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$  if a = 'webdone' then$a$, ''))) / length($a$  if a = 'webdone' then$a$);
  if n <> 1 then raise exception 'desk_act patch matched % times', n; end if;
  d := replace(d, $a$  if a = 'webdone' then$a$, $b$  if a = 'ql_ask' then
    if v_role not in ('junior','senior') or r.sales_id is distinct from me.id or r.stage = 'closed' or r.first_at is null or coalesce(r.ql_state, '') in ('asked','yes') then
      raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.requests set ql_state = 'asked', ql_at = now(), ql_note = note where id = r.id;
    perform public._event(r.id, 'طلب اعتماده كواليفايد ليد' || coalesce(': ' || left(note, 200), ''));
    perform public._notify(case when r.tl_id is not null then public._user_of(r.tl_id) else public._users_of('tl') end, r.id, who || ' طالب اعتماد ' || t || ' كواليفايد ليد');
    return;
  end if;

  if a in ('ql_ok','ql_no') then
    if v_role <> 'tl' or (r.tl_id is not null and r.tl_id <> me.id) or r.ql_state is distinct from 'asked' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if a = 'ql_no' and note is null then raise exception 'note_required' using errcode = '22023'; end if;
    update public.requests set ql_state = case when a = 'ql_ok' then 'yes' else 'no' end, ql_at = now(), ql_note = coalesce(note, ql_note) where id = r.id;
    perform public._event(r.id, case when a = 'ql_ok' then 'اعتمده كواليفايد ليد' else 'مش كواليفايد ليد: ' || left(note, 200) end);
    perform public._notify(public._user_of(r.sales_id) || public._user_of(r.sup_id), r.id,
      who || case when a = 'ql_ok' then ' اعتمد ' || t || ' كواليفايد ليد' else ' قال إن ' || t || ' مش كواليفايد ليد' end);
    return;
  end if;

  if a = 'webdone' then$b$);
  execute d;
end $patch$;
