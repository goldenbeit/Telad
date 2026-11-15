-- Editing a plot covers everything the seller's form has (15/11): the allocated stage, on the list / check paid
-- for unallocated plots, and the payment items and dates (pay). Keys that are not sent are left as they are.
do $m$
declare d text := pg_get_functiondef('public.admin_update_listing(bigint,jsonb)'::regprocedure); n int;
  a text := $a$    description = btrim(coalesce(p->>'description',''))
  where id = p_id;$a$;
begin
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  if n <> 1 then raise exception 'admin_update_listing patch matched % times', n; end if;
  execute replace(d, a, $b$    description = btrim(coalesce(p->>'description','')),
    stage = case when not (p ? 'stage') then stage when v_d is not null then nullif(p->>'stage','') end,
    on_list = case when not (p ? 'on_list') then on_list when v_d is null then (p->>'on_list')::boolean end,
    check_paid = case when not (p ? 'check_paid') then check_paid when v_d is null then (p->>'check_paid')::boolean end,
    pay = case when jsonb_typeof(p->'pay') = 'object' then pay || (p->'pay') else pay end
  where id = p_id;$b$);
end $m$;
