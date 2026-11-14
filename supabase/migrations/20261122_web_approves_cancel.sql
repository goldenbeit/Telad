-- The final approval of a cancelled request (not sold, back with the sales admin) can be given by the
-- sales admin OR the web admin. Both get the alert; either one can close it or send it back down.
-- Not for "متابعة من ليفل أعلى" (follow-up): that stays with the sales admin.

do $patch$
declare
  d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  pairs text[][] := array[
    -- close: the web admin may close a cancelled request waiting with the sales admin
    [$a$    if v_role not in ('owner','sadmin') or not (r.stage = 'up_sa' or (r.via in ('ask','wa') and r.stage = 'new') or (r.via = 'ask' and r.stage <> 'closed')) then$a$,
     $b$    if not ((v_role in ('owner','sadmin') and (r.stage = 'up_sa' or (r.via in ('ask','wa') and r.stage = 'new') or (r.via = 'ask' and r.stage <> 'closed')))
        or (v_role = 'web' and r.stage = 'up_sa' and r.outcome = 'lost' and r.cx_action is distinct from 'escalate')) then$b$],
    [$a$    v_out := coalesce(nullif(p->>'outcome',''), r.outcome);$a$,
     $b$    v_out := coalesce(nullif(p->>'outcome',''), r.outcome);
    if v_role = 'web' and v_out is distinct from 'lost' then raise exception 'not_allowed' using errcode = '42501'; end if;$b$]
  ];
  i int; n int;
begin
  for i in 1 .. array_length(pairs, 1) loop
    n := (length(d) - length(replace(d, pairs[i][1], ''))) / length(pairs[i][1]);
    if n <> 1 then raise exception 'patch % matched % times', i, n; end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  -- down from the sales admin's step: also the web admin, for a cancelled request (2 places)
  n := (length(d) - length(replace(d, $a$v_role in ('owner','sadmin') and r.stage = 'up_sa'$a$, ''))) / length($a$v_role in ('owner','sadmin') and r.stage = 'up_sa'$a$);
  if n <> 2 then raise exception 'down patch matched % times', n; end if;
  d := replace(d, $a$v_role in ('owner','sadmin') and r.stage = 'up_sa'$a$, $b$(v_role in ('owner','sadmin') or (v_role = 'web' and r.outcome = 'lost' and r.cx_action is distinct from 'escalate')) and r.stage = 'up_sa'$b$);
  -- alerts: a cancelled request reaching the sales admin also alerts the web admin (2 places in "up")
  n := (length(d) - length(replace(d, $a$public._notify(public._users_of('sadmin'), r.id, who || ' بعت ' || t || ' (راجع)');$a$, ''))) / length($a$public._notify(public._users_of('sadmin'), r.id, who || ' بعت ' || t || ' (راجع)');$a$);
  if n <> 2 then raise exception 'up alert patch matched % times', n; end if;
  d := replace(d, $a$public._notify(public._users_of('sadmin'), r.id, who || ' بعت ' || t || ' (راجع)');$a$,
    $b$public._notify(public._users_of('sadmin') || case when r.outcome = 'lost' and r.cx_action is distinct from 'escalate' then public._users_of('web') else '{}'::uuid[] end, r.id, who || ' بعت ' || t || ' (راجع)' || case when r.outcome = 'lost' and r.cx_action is distinct from 'escalate' then ' · البيعة اتلغت، مستني اعتماد الإلغاء' else '' end);$b$);
  -- and in the supervisor's cancel action (confirm / other)
  n := (length(d) - length(replace(d, $a$perform public._notify(public._users_of('sadmin'), r.id, who || case when k = 'escalate'$a$, ''))) / length($a$perform public._notify(public._users_of('sadmin'), r.id, who || case when k = 'escalate'$a$);
  if n <> 1 then raise exception 'cx alert patch matched % times', n; end if;
  d := replace(d, $a$perform public._notify(public._users_of('sadmin'), r.id, who || case when k = 'escalate'$a$,
    $b$perform public._notify(public._users_of('sadmin') || case when k <> 'escalate' then public._users_of('web') else '{}'::uuid[] end, r.id, who || case when k = 'escalate'$b$);
  execute d;
end $patch$;
