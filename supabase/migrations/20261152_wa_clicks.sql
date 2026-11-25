-- تبويب "واتساب" (25/11): كل دوسة على زرار واتساب في الموقع بتتسجّل سطر للعلم بس، للتيم ليدر فما فوق.
-- من غير اسم ولا رقم، ومش بتدخل المسار ولا الجرس ولا الإشعارات. البيانات بتتاخد من القاعدة مش من المتصفح.
create table if not exists public.wa_clicks (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('plot','district','general','seller')),
  place text,
  listing_id bigint references public.listings(id) on delete set null,
  code text, zone text, district int
);
create index if not exists wa_clicks_at on public.wa_clicks (at desc);
alter table public.wa_clicks enable row level security;
revoke all on public.wa_clicks from public, anon, authenticated;

create or replace function public.wa_log(p jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare k text := p->>'kind'; pl text := left(p->>'place', 20); l record; z text; d int;
begin
  if (select count(*) from public.wa_clicks where at > now() - interval '1 hour') >= 300 then return; end if;
  if pl is not null and pl !~ '^[a-z_]+$' then pl := null; end if;
  if k in ('plot','seller') then
    select id, code, zone, district into l from public.listings
      where code = upper(p->>'code') and (state = 'approved' or k = 'seller') limit 1;
    if l.id is null then return; end if;
    if k = 'seller' and exists (select 1 from public.wa_clicks where kind = 'seller' and listing_id = l.id) then return; end if;
    if (select count(*) from public.wa_clicks where listing_id = l.id and at > now() - interval '1 hour') >= 20 then return; end if;
    insert into public.wa_clicks (kind, place, listing_id, code, zone, district) values (k, pl, l.id, l.code, l.zone, l.district);
  elsif k = 'district' then
    z := p->>'zone'; d := nullif(p->>'district', '')::int;
    if z not in ('القادسية','الأمل') then return; end if;
    if d is not null and not ((z = 'القادسية' and d in (8,9,10,12,17,20,22,23)) or (z = 'الأمل' and d in (28,29,30,31,32,33,35,36))) then return; end if;
    insert into public.wa_clicks (kind, place, zone, district) values (k, pl, z, d);
  elsif k = 'general' then
    insert into public.wa_clicks (kind, place) values (k, pl);
  end if;
exception when others then return; -- a bad click never shows an error to a visitor
end $$;
revoke all on function public.wa_log(jsonb) from public;
grant execute on function public.wa_log(jsonb) to anon, authenticated;

create or replace function public.desk_wa_clicks()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not public._can_price_review() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(w) order by w.at desc) from (
    select id, at, kind, place, code, zone, district from public.wa_clicks
    where at > now() - interval '30 days' order by at desc limit 1000) w), '[]'::jsonb);
end $$;
revoke all on function public.desk_wa_clicks() from public, anon;
grant execute on function public.desk_wa_clicks() to authenticated;
