-- Supabase SQL Editor에서 한 번 실행. 에어비앤비 예약 감시 상태 저장용 (서비스 키로만 접근, 사이트 방문자는 못 봄)
create table if not exists public.airbnb_events (
  uid text primary key,
  summary text,
  start_date date not null,
  end_date date not null,
  reservation_url text,
  phone_last4 text,
  status text not null default 'active',      -- active | cancelled
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  cancelled_at timestamptz
);
create table if not exists public.app_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.airbnb_events enable row level security;
alter table public.app_state enable row level security;
-- 정책을 만들지 않으므로 anon 키로는 읽기·쓰기 모두 불가. 감시 작업은 service_role 키를 사용.
