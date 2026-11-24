-- "حاسبة التقنين" (24/11): the allocated plots with أصل المساحة and what is recorded for their installments, for the
-- installment review in the desk. Team lead and above (_can_price_review). No seller name or phone.
create or replace function public.desk_calc_plots() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'code', l.code, 'state', l.state, 'zone', l.zone, 'district', l.district, 'stage', l.stage,
      'area_orig', l.area_orig, 'area_final', l.area_final, 'paid', l.paid, 'price', l.price, 'remaining', l.remaining,
      'inst_left', l.inst_left, 'import_id', l.import_id, 'src', l.pay ->> 'src',
      'inst_value', l.pay -> 'inst_value', 'inst_first', l.pay ->> 'inst_first', 'inst_last', l.pay ->> 'inst_last',
      'items', l.pay -> 'items') order by l.id)
    from public.listings l
    where l.allocated is true and l.area_orig is not null and l.state in ('approved', 'pending', 'hidden', 'sold', 'archived')), '[]'::jsonb);
end $$;
revoke execute on function public.desk_calc_plots() from public, anon;
grant execute on function public.desk_calc_plots() to authenticated;
