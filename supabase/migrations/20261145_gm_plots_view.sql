-- The GM sees the plots tab read-only (22/11): every plot, its details and its allocation letter, without editing,
-- publishing, hiding or deleting (those still check _can_plots(): owner / super admin / web admin).
create or replace function public._can_plots_view() returns boolean language sql stable security definer set search_path = ''
as $$ select public._can_plots() or coalesce(public._role() = 'gm', false) $$;
revoke execute on function public._can_plots_view() from public, anon, authenticated;

do $m$
declare f text; d text; a text := 'public._can_plots()';
begin
  foreach f in array array['admin_listings', 'admin_listings_since', '_can_letter'] loop
    d := pg_get_functiondef(('public.' || f)::regproc);
    if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception '% patch: expected 1 match', f; end if;
    execute replace(d, a, 'public._can_plots_view()');
  end loop;
end $m$;
