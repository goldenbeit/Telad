-- "البيعة اتلغت": when a salesperson returns a request as not sold, the supervisor picks what happens next:
--   reassign  (تغيير وش)           another salesperson takes the request
--   escalate  (متابعة من ليفل أعلى) it goes up to the team leader (or the sales admin) to follow up
--   postpone  (تأجيل حتى)           it goes back to the same salesperson, due on a chosen day
--   confirm   (تأكيد إلغاء)         it goes up for the sales admin to cancel it for good
--   other     (أخرى)                same as confirm, with a required note
-- The sales admin approves the final cancellation and picks one or more evaluation reasons for the reports.

alter table public.requests
  add column if not exists cx_action text check (cx_action in ('reassign','escalate','postpone','confirm','other')),
  add column if not exists cx_until timestamptz,
  add column if not exists cx_eval text[],
  add column if not exists cx_count int not null default 0;

do $patch$
declare d text; n int;
begin
  -- desk_requests returns the cancellation fields
  d := pg_get_functiondef('public.desk_requests()'::regprocedure);
  n := (length(d) - length(replace(d, $a$'ql_note', r.ql_note,$a$, ''))) / length($a$'ql_note', r.ql_note,$a$);
  if n <> 1 then raise exception 'desk_requests patch matched % times', n; end if;
  d := replace(d, $a$'ql_note', r.ql_note,$a$, $b$'ql_note', r.ql_note, 'cx', r.cx_action, 'cx_until', r.cx_until, 'cx_eval', r.cx_eval, 'cx_count', r.cx_count,$b$);
  execute d;

  d := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  -- final cancellation needs at least one evaluation reason
  n := (length(d) - length(replace(d, $a$    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;$a$, ''))) / length($a$    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;$a$);
  if n <> 1 then raise exception 'close patch 1 matched % times', n; end if;
  d := replace(d, $a$    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;$a$, $b$    if v_out = 'lost' and (jsonb_typeof(p->'eval') is distinct from 'array' or jsonb_array_length(p->'eval') = 0) then raise exception 'eval_required' using errcode = '22023'; end if;
    if v_out = 'lost' and exists (select 1 from jsonb_array_elements_text(p->'eval') x where x not in ('fake','not_qualified','sales_late','followup_late','competitor','market','real_reason','hesitant','other')) then
      raise exception 'eval_required' using errcode = '22023'; end if;
    update public.request_legs set ended_at = now() where request_id = r.id and ended_at is null;$b$);
  n := (length(d) - length(replace(d, $a$stage = 'closed', closed_at = now(), outcome = v_out,$a$, ''))) / length($a$stage = 'closed', closed_at = now(), outcome = v_out,$a$);
  if n <> 1 then raise exception 'close patch 2 matched % times', n; end if;
  d := replace(d, $a$stage = 'closed', closed_at = now(), outcome = v_out,$a$, $b$stage = 'closed', closed_at = now(), outcome = v_out,
      cx_eval = case when v_out = 'lost' then (select array_agg(distinct x) from jsonb_array_elements_text(p->'eval') x) end,$b$);

  -- the supervisor's action on a not-sold return
  n := (length(d) - length(replace(d, $a$  if a = 'webdone' then$a$, ''))) / length($a$  if a = 'webdone' then$a$);
  if n <> 1 then raise exception 'cx patch matched % times', n; end if;
  d := replace(d, $a$  if a = 'webdone' then$a$, $b$  if a = 'cx' then
    if v_role <> 'sup' or r.stage <> 'up_sup' or r.sup_id is distinct from me.id or r.outcome is distinct from 'lost' then raise exception 'not_allowed' using errcode = '42501'; end if;
    k := p->>'do';
    if k not in ('reassign','escalate','postpone','confirm','other') then raise exception 'invalid_action' using errcode = '22023'; end if;
    if k = 'other' and note is null then raise exception 'note_required' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    if k = 'reassign' then
      if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
      select * into v_sales from public.staff where id = nullif(p->>'sales_id','')::bigint and staff.role in ('junior','senior') and active;
      if v_sales.id is null or v_sales.id = r.sales_id then raise exception 'invalid_sales' using errcode = '22023'; end if;
      update public.requests set sales_id = v_sales.id, stage = 'sales', outcome = null, outcome_reason = null, outcome_summary = null,
        st_key = null, st_at = null, st_due = null, first_at = null, cx_action = 'reassign', cx_until = null, cx_count = cx_count + 1 where id = r.id;
      perform public._leg(r.id, v_sales.id, v_sales.role, mins);
      perform public._event(r.id, 'البيعة اتلغت · تغيير وش: من ' || coalesce((select s.name from public.staff s where s.id = r.sales_id), '—') || ' لـ' || v_sales.name);
      perform public._notify(public._user_of(v_sales.id), r.id, who || ' اداك ' || t || ' (تغيير وش)');
    elsif k = 'postpone' then
      if coalesce(p->>'until','') !~ '^\d{4}-\d{2}-\d{2}$' or (p->>'until')::date <= current_date or (p->>'until')::date > current_date + 180 then
        raise exception 'invalid_until' using errcode = '22023'; end if;
      update public.requests set stage = 'sales', outcome = null, outcome_reason = null, outcome_summary = null,
        st_due = ((p->>'until')::date + time '10:00') at time zone 'Africa/Cairo', cx_action = 'postpone', cx_until = ((p->>'until')::date + time '10:00') at time zone 'Africa/Cairo', cx_count = cx_count + 1 where id = r.id;
      insert into public.request_legs (request_id, staff_id, role, due_at) values (r.id, r.sales_id, (select s.role from public.staff s where s.id = r.sales_id), ((p->>'until')::date + time '10:00') at time zone 'Africa/Cairo');
      perform public._event(r.id, 'البيعة اتلغت · اتأجل لحد ' || to_char((p->>'until')::date, 'DD/MM/YYYY'));
      perform public._notify(public._user_of(r.sales_id), r.id, who || ' أجّل ' || t || ' لحد ' || to_char((p->>'until')::date, 'DD/MM') || '. كلّم العميل تاني ساعتها.');
    else
      if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
      if r.tl_id is not null and r.tl_mode = 'confirm' then
        update public.requests set stage = 'up_tl', cx_action = k where id = r.id;
        perform public._leg(r.id, r.tl_id, 'tl', mins);
        perform public._notify(public._user_of(r.tl_id), r.id, who || case when k = 'escalate' then ' طالب متابعة منك في ' else ' بعت لك إلغاء ' end || t);
      else
        update public.requests set stage = 'up_sa', cx_action = k where id = r.id;
        perform public._leg(r.id, null, 'sadmin', mins);
        perform public._notify(public._users_of('sadmin'), r.id, who || case when k = 'escalate' then ' طالب متابعة منك في ' else ' بعت لك إلغاء ' end || t);
        if r.tl_id is not null then perform public._notify(public._user_of(r.tl_id), r.id, 'للعلم: ' || who || ' بعت ' || t || ' للسيلز أدمن (البيعة اتلغت)'); end if;
      end if;
      perform public._event(r.id, 'البيعة اتلغت · ' || case k when 'escalate' then 'متابعة من ليفل أعلى' when 'confirm' then 'تأكيد إلغاء' else 'أخرى' end);
    end if;
    return;
  end if;

  if a = 'webdone' then$b$);
  execute d;
end $patch$;
