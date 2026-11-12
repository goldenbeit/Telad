-- No manager tree: each step picks the next person by role.
-- Sales admin picks a team leader (confirm: TL confirms and picks the supervisor) or, for "info"/no TL, the supervisor directly.
-- Supervisors can give a request to any active salesperson. Returns still go back up through whoever handled it.
-- Applied on 2026-11-12 by rewriting the forward/ack/confirm/assign part of public.desk_act (see the live function),
-- adding the declarations v_tl public.staff and v_mode text, and clearing staff.parent_id.
update public.staff set parent_id = null;
