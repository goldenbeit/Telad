-- Two accounts, one person (19/11): د غادة and ا رغده are supervisors and also work plots as seniors. Each keeps her two
-- separate accounts, linked here, so the dashboard can switch between them with one tap (the second login is kept on
-- her phone only), and both accounts' phone notifications reach the same phone, each labelled with its role.

alter table public.staff add column if not exists alt_id bigint references public.staff(id) on delete set null;
update public.staff set alt_id = 62 where id = 41;
update public.staff set alt_id = 41 where id = 62;
update public.staff set alt_id = 63 where id = 42;
update public.staff set alt_id = 42 where id = 63;

-- who am I: plus the linked account (its id, role and phone, for the switch)
create or replace function public.desk_me() returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare s public.staff := public._me(); adm boolean := public.is_admin(); a public.staff;
begin
  if adm and public._acting() is null then return jsonb_build_object('owner', true, 'role', 'owner', 'name', 'الأدمن', 'id', null, 'can_act', true); end if;
  if s.id is null then return null; end if;
  if not adm and s.alt_id is not null then select * into a from public.staff where id = s.alt_id and active and user_id is not null; end if;
  return jsonb_build_object('owner', false, 'id', s.id, 'name', s.name, 'role', s.role, 'avail', s.avail, 'parent_id', s.parent_id, 'acting', adm, 'can_act', adm,
    'alt', case when a.id is not null then jsonb_build_object('id', a.id, 'role', a.role, 'phone', a.phone) end);
end $function$;

-- one phone can carry both linked accounts' notifications
alter table public.push_subs drop constraint if exists push_subs_endpoint_key;
create unique index if not exists push_subs_endpoint_user on public.push_subs (endpoint, user_id);

-- the caller's own login and, if linked, the other account's login
create or replace function public._my_uids() returns uuid[] language sql stable security definer set search_path = ''
as $$
  select array_remove(array[(select auth.uid()),
    (select a.user_id from public.staff s join public.staff a on a.id = s.alt_id where s.user_id = (select auth.uid()) and a.active)], null)
$$;
revoke execute on function public._my_uids() from public, anon, authenticated;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public._role() is null then raise exception 'not_staff' using errcode = '42501'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'invalid_subscription' using errcode = '22023'; end if;
  -- the phone now belongs to this person: anyone else's registration on it goes (the linked account stays)
  delete from public.push_subs where endpoint = p_endpoint and user_id <> all (public._my_uids());
  insert into public.push_subs (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint, user_id) do update set p256dh = excluded.p256dh, auth = excluded.auth, fails = 0;
end $$;

-- signing out: the phone stops getting both linked accounts' notifications
create or replace function public.push_unsubscribe(p_endpoint text) returns void language sql security definer set search_path = ''
as $$ delete from public.push_subs where endpoint = p_endpoint and user_id = any (public._my_uids()) $$;

-- a notification for a linked account says which role it is for, and opens the dashboard on that account
create or replace function public._push_label() returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.staff;
begin
  select * into s from public.staff where user_id = new.user_id and alt_id is not null limit 1;
  if s.id is not null then
    new.title := case s.role when 'sup' then 'مشرف' when 'senior' then 'سينيور' when 'junior' then 'جونيور' when 'tl' then 'تيم ليدر' else s.role end || ' · ' || new.title;
    new.url := new.url || case when position('?' in new.url) > 0 then '&' else '?' end || 'acct=' || s.id;
  end if;
  return new;
end $$;
revoke execute on function public._push_label() from public, anon, authenticated;
drop trigger if exists push_out_label on public.push_out;
create trigger push_out_label before insert on public.push_out for each row execute function public._push_label();
