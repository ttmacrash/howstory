-- 하우-스토리 (How-Story) 1단계 스키마 v1
-- Supabase SQL Editor에서 한 번 실행합니다. 기존 airbnb_events / app_state 표는 건드리지 않습니다.
-- 도메인 번호는 docs/platform-architecture.md 를 따릅니다. (D1 계정, D2 숙소, D4 요금·재고, D8 운영)

create extension if not exists pgcrypto;

-- ---------- D1. 계정 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'ko',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- 이미 가입돼 있는 사용자에게도 프로필을 만들어 준다 (트리거는 이후 가입자만 처리)
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)) from auth.users u
on conflict (id) do nothing;

-- ---------- D2. 숙소 ----------
do $$ begin
  create type public.listing_status as enum ('draft', 'review', 'published', 'paused', 'hidden');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.listing_type as enum ('entire_home', 'private_room', 'shared_room', 'hotel_room');
exception when duplicate_object then null; end $$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,                                   -- 호스트용 내부 이름
  listing_type public.listing_type not null default 'entire_home',
  max_guests int not null default 2 check (max_guests > 0),
  bedrooms int not null default 1,
  beds int not null default 1,
  bathrooms numeric(3,1) not null default 1,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text not null default 'KR',
  lat double precision,
  lng double precision,
  checkin_time time not null default '15:00',
  checkout_time time not null default '11:00',
  min_nights int not null default 1 check (min_nights > 0),
  max_nights int,
  status public.listing_status not null default 'draft',
  default_locale text not null default 'ko',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_host_idx on public.listings(host_id);

-- 언어별 콘텐츠. 한 숙소에 ko/en/zh/ja 행이 각각 하나.
create table if not exists public.listing_contents (
  listing_id uuid not null references public.listings(id) on delete cascade,
  locale text not null check (locale in ('ko', 'en', 'zh', 'ja')),
  title text,
  summary text,
  description text,
  house_rules text,
  checkin_guide text,
  is_machine_translated boolean not null default false,
  source_version int not null default 1,                -- 어떤 버전의 원문(ko)에서 번역됐는지
  updated_at timestamptz not null default now(),
  primary key (listing_id, locale)
);

-- ---------- D4. 재고 · 외부 채널 ----------
do $$ begin
  create type public.channel_kind as enum ('airbnb', 'yanolja', 'yeogieottae', 'booking', 'agoda', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.channel_sources (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  channel public.channel_kind not null,
  label text,
  ical_url text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,                           -- null이면 아직 첫 동기화 전 (첫 동기화는 알림 없이 기준선만 저장)
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists channel_sources_listing_idx on public.channel_sources(listing_id);

do $$ begin
  create type public.booking_status as enum ('active', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.booking_origin as enum ('channel', 'manual', 'direct');
exception when duplicate_object then null; end $$;

-- 예약. OTA에서 iCal로 들어온 것(channel), 호스트가 손으로 넣은 것(manual), 2단계 자체 예약(direct)을 한 표에 둔다.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  source_id uuid references public.channel_sources(id) on delete set null,
  origin public.booking_origin not null default 'manual',
  external_uid text,
  check_in date not null,
  check_out date not null,
  guest_name text,
  guest_locale text,
  guest_phone_last4 text,
  reservation_url text,
  note text,
  status public.booking_status not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id),
  constraint bookings_dates_chk check (check_out > check_in),
  constraint bookings_external_uid_uniq unique (source_id, external_uid)
);
create index if not exists bookings_listing_dates_idx on public.bookings(listing_id, check_in, check_out);

-- 예약 변화 기록. notified_at이 null이면 아직 호스트에게 알리지 않은 것.
create table if not exists public.booking_events (
  id bigserial primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  kind text not null check (kind in ('new', 'changed', 'cancelled', 'restored', 'manual_created', 'manual_cancelled')),
  detail jsonb,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists booking_events_pending_idx on public.booking_events(notified_at) where notified_at is null;

-- 같은 숙소에서 날짜가 겹치는 활성 예약 쌍 (이중 예약 감지)
create or replace view public.booking_conflicts as
select a.listing_id, a.id as booking_id, b.id as other_booking_id,
       greatest(a.check_in, b.check_in) as overlap_start,
       least(a.check_out, b.check_out) as overlap_end
from public.bookings a
join public.bookings b
  on a.listing_id = b.listing_id and a.id < b.id
where a.status = 'active' and b.status = 'active'
  and a.check_in < b.check_out and b.check_in < a.check_out;

-- ---------- updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings for each row execute procedure public.touch_updated_at();
drop trigger if exists listing_contents_touch on public.listing_contents;
create trigger listing_contents_touch before update on public.listing_contents for each row execute procedure public.touch_updated_at();

-- ---------- RLS: 호스트는 자기 숙소의 데이터만 ----------
create or replace function public.is_listing_owner(p_listing_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listings l where l.id = p_listing_id and l.host_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_contents enable row level security;
alter table public.channel_sources enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists listings_owner on public.listings;
create policy listings_owner on public.listings for all using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists listing_contents_owner on public.listing_contents;
create policy listing_contents_owner on public.listing_contents for all
  using (public.is_listing_owner(listing_id)) with check (public.is_listing_owner(listing_id));

drop policy if exists channel_sources_owner on public.channel_sources;
create policy channel_sources_owner on public.channel_sources for all
  using (public.is_listing_owner(listing_id)) with check (public.is_listing_owner(listing_id));

drop policy if exists bookings_owner on public.bookings;
create policy bookings_owner on public.bookings for all
  using (public.is_listing_owner(listing_id)) with check (public.is_listing_owner(listing_id));

drop policy if exists booking_events_owner on public.booking_events;
create policy booking_events_owner on public.booking_events for all
  using (public.is_listing_owner(listing_id)) with check (public.is_listing_owner(listing_id));

-- 뷰는 기반 표의 RLS를 따른다 (security_invoker)
alter view public.booking_conflicts set (security_invoker = on);
