-- When a phone can't turn notifications on, the reason is kept here so it can be read (19/11: د سارة's phone failed at
-- the browser's own subscribe step and the screen only said "try again").
create table if not exists public.push_errors (
  id bigserial primary key, user_id uuid, step text, name text, message text, ua text, at timestamptz not null default now());
alter table public.push_errors enable row level security;

create or replace function public.push_log_error(p_step text, p_name text, p_message text, p_ua text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public._role() is null then return; end if;
  insert into public.push_errors (user_id, step, name, message, ua)
  values (auth.uid(), left(p_step, 40), left(p_name, 80), left(p_message, 400), left(p_ua, 300));
end $$;
revoke execute on function public.push_log_error(text, text, text, text) from public, anon;
grant execute on function public.push_log_error(text, text, text, text) to authenticated;
