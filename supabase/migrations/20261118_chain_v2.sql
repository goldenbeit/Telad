-- Buyer-request chain v2 (matches the approved mockup):
-- * a request shows every detail of its unit, with the seller's name and phone, to everyone who can see the request
-- * sales finish with "sold" or "not sold" only, and the summary is optional
-- * a request sent straight to a supervisor (TL informed only) goes back up to the sales admin without the TL, both ways
-- * WhatsApp taps are no longer recorded

create or replace function public.desk_request(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.requests;
begin
  select * into r from public.requests where id = p_id;
  if r.id is null or not public._can_see(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'unit', (select jsonb_build_object('code', l.code, 'state', l.state, 'zone', l.zone, 'district', l.district, 'neighborhood', l.neighborhood, 'block', l.block,
        'plot', pr.plot_number, 'area_orig', l.area_orig, 'area_final', l.area_final, 'facade', l.facade, 'view_type', l.view_type,
        'price', l.price, 'paid', l.paid, 'remaining', l.remaining, 'inst_left', l.inst_left, 'pay', l.pay,
        'stage', l.stage, 'allocated', l.allocated, 'on_list', l.on_list, 'check_paid', l.check_paid,
        'description', l.description, 'photo_path', l.photo_path, 'has_letter', pr.letter_path is not null,
        'owner_name', pr.owner_name, 'owner_phone', pr.phone)
      from public.listings l left join public.listing_private pr on pr.listing_id = l.id where l.id = r.listing_id),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('who', case when n.by_owner then 'الأدمن' else s.name end, 'role', s.role, 'kind', n.kind, 'body', n.body, 'at', n.created_at) order by n.id)
      from public.request_notes n left join public.staff s on s.id = n.staff_id where n.request_id = p_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('who', case when e.by_owner then 'الأدمن' else s.name end, 'body', e.body, 'at', e.created_at) order by e.id desc)
      from public.request_events e left join public.staff s on s.id = e.staff_id where e.request_id = p_id), '[]'::jsonb));
end $$;

do $patch$
declare
  d text := pg_get_functiondef('public.desk_act(bigint,jsonb)'::regprocedure);
  pairs text[][] := array[
    -- summary optional; only sold / lost
    [$a$    if nullif(btrim(coalesce(p->>'summary','')), '') is null then raise exception 'summary_required' using errcode = '22023'; end if;
$a$, $b$    if v_out not in ('sold','lost') then raise exception 'invalid_outcome' using errcode = '22023'; end if;
$b$],
    [$a$outcome_summary = btrim(p->>'summary'),$a$, $b$outcome_summary = nullif(btrim(coalesce(p->>'summary','')), ''),$b$],
    -- informed-only TL: supervisor sends it straight back to the sales admin
    [$a$r.stage = 'up_sup' and r.sup_id = me.id and r.tl_id is null then$a$, $b$r.stage = 'up_sup' and r.sup_id = me.id and (r.tl_id is null or r.tl_mode = 'info') then$b$],
    -- and the sales admin sends it back down to the supervisor
    [$a$r.stage = 'up_sa' and r.tl_id is null then$a$, $b$r.stage = 'up_sa' and (r.tl_id is null or r.tl_mode = 'info') then$b$]
  ];
  i int;
begin
  for i in 1 .. array_length(pairs, 1) loop
    if (length(d) - length(replace(d, pairs[i][1], ''))) / length(pairs[i][1]) <> 1 then
      raise exception 'desk_act patch % did not match exactly once', i;
    end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;
end $patch$;

revoke execute on function public.wa_click(bigint) from public, anon, authenticated;
