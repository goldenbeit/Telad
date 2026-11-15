-- Plots move into the desk (15/11) and the listings dashboard goes away.
--  * "القطع" tab: the owner, super admin and web admin list, edit, mark sold, hide and republish plots
--    (_can_plots). Final delete stays with the owner and the super admin (_can_listings).
--  * The web admin's "شيلتها من الموقع" task now also marks the plot sold.
--  * The team leader can send a request / offer straight to a salesperson / reviewer (beside the supervisor path);
--    a supervisor is still picked, and the return goes through that supervisor as usual.

create or replace function public._can_plots() returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() or coalesce(public._role() in ('super','web'), false); $$;
revoke execute on function public._can_plots() from public, anon;

do $m$
declare f text; d text; n int;
begin
  foreach f in array array['admin_listings()', 'admin_set_state(bigint,text)', 'admin_update_listing(bigint,jsonb)', '_can_letter(text)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    n := (length(d) - length(replace(d, 'public._can_listings()', ''))) / length('public._can_listings()');
    if n <> 1 then raise exception '% has % listing checks', f, n; end if;
    execute replace(d, 'public._can_listings()', 'public._can_plots()');
  end loop;
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
  -- "شيلتها من الموقع" marks the plot sold
  d := pg_temp.rep(d, $a$    update public.requests set web_task = false where id = r.id;
    perform public._event(r.id, 'شال القطعة من الموقع');$a$,
  $b$    update public.requests set web_task = false where id = r.id;
    update public.listings set state = 'sold', reviewed_at = now() where id = r.listing_id and state in ('approved','hidden');
    perform public._event(r.id, 'علّم القطعة اتباعت وشالها من الموقع');$b$, 1);

  -- the team leader sends straight to a salesperson, with a supervisor for the way back
  d := pg_temp.rep(d, $a$  if a = 'confirm' then
$a$, $b$  if a = 'confirm' and nullif(p->>'sales_id', '') is not null then
    if v_role <> 'tl' or r.stage <> 'tl' or r.tl_id is distinct from me.id then raise exception 'not_allowed' using errcode = '42501'; end if;
    if mins is null then raise exception 'mins_required' using errcode = '22023'; end if;
    select * into v_sup from public.staff where id = nullif(p->>'sup_id','')::bigint and staff.role = 'sup' and active;
    if v_sup.id is null then raise exception 'invalid_sup' using errcode = '22023'; end if;
    select * into v_sales from public.staff where id = nullif(p->>'sales_id','')::bigint and staff.role in ('junior','senior') and active;
    if v_sales.id is null then raise exception 'invalid_sales' using errcode = '22023'; end if;
    perform public._close_legs(r.id);
    update public.requests set tl_ack = true, stage = 'sales', sup_id = v_sup.id, sales_id = v_sales.id where id = r.id;
    perform public._leg(r.id, v_sales.id, v_sales.role, mins);
    if note is not null then insert into public.request_notes (request_id, staff_id, kind, body) values (r.id, me.id, 'instr', note); end if;
    perform public._event(r.id, 'أكّد واداه لـ' || v_sales.name || ' على طول (والرجوع على ' || v_sup.name || ')');
    perform public._notify(public._user_of(v_sales.id), r.id, who || ' اداك ' || t);
    perform public._notify(public._user_of(v_sup.id), r.id, who || ' ادى ' || t || ' لـ' || v_sales.name || ' على طول، والرجوع عليك');
    perform public._notify(public._users_of('sadmin'), r.id, who || ' أكّد ' || t || ' واداه لـ' || v_sales.name);
    return;
  end if;

  if a = 'confirm' then
$b$, 1);
  execute d;
end $m$;
