# 하우-스토리 (How-Story) 호스트 앱

1단계 "호스트 운영 도구"의 웹앱입니다. 요구사항은 `../docs/prd-host-tools.md`, 전체 구조는 `../docs/platform-architecture.md`.

- Next.js 16 (App Router, 서버 액션) + Tailwind v4
- Supabase (Auth 이메일 로그인, Postgres, RLS)
- 채널 iCal 동기화: 앱의 "지금 동기화" 버튼과 GitHub Actions 10분 크론이 같은 엔진(`src/lib/sync/engine.mjs`)을 씁니다.

## 지금 되는 것 (0단계)

| 화면 | 경로 | 내용 |
|---|---|---|
| 로그인·회원가입 | `/login` | 이메일 + 비밀번호 |
| 대시보드 | `/dashboard` | 숙소별 요약, 다가오는 예약, 날짜 겹침 경고 |
| 숙소 | `/listings`, `/listings/new`, `/listings/[id]` | 기본 정보, 언어별(한·영·중·일) 소개·규칙·체크인 안내 |
| 통합 캘린더 | `/listings/[id]/calendar` | 월 달력, 채널 예약 + 직접 입력 예약, 겹침 표시 |
| 채널 연결 | `/listings/[id]/channels` | iCal 주소 등록, 지금 동기화, 중지·삭제 |

## 처음 설정 (순서대로)

**A. Supabase 준비** (5분)

1. **DB 표 만들기**: Supabase → SQL Editor → `supabase/migrations/0001_init.sql` 내용을 붙여넣고 실행. 기존 `airbnb_events`, `app_state` 표는 그대로 둡니다.
2. **이메일 로그인 켜기**: Authentication → Sign In / Providers → Email 이 켜져 있는지 확인(기본값 켜짐).
   - 개발 중에는 같은 화면의 **Confirm email**을 끄면 가입 즉시 로그인됩니다. 켜 둘 거라면 Authentication → URL Configuration → Redirect URLs에 `http://localhost:3000/auth/confirm` 을 추가하세요.

**B. 로컬 실행** (5분)

3. `.env.example`을 `.env.local`로 복사하고 두 값만 채웁니다. Supabase → Project Settings → API의 URL과 anon(publishable) 키입니다. 나머지 줄(`SUPABASE_SERVICE_KEY`, `KAKAO_*`)은 로컬에서는 비워 둬도 됩니다.
4. 실행:
   ```bash
   cd platform
   npm install
   npm run dev      # http://localhost:3000
   ```

**C. 앱에서 숙소와 채널 연결** (10분)

5. `/login` → 회원가입 → 로그인.
6. **숙소 등록** → 이름·인원·체크인 시간 정도만 넣고 저장.
7. 숙소 → **채널 연결** → 에어비앤비 iCal 주소 붙여넣고 추가. (주소 얻는 법: 호스트 모드 → 캘린더 → 사용 가능 여부 설정 → 캘린더 연결 → 캘린더 내보내기)
8. **지금 동기화** 클릭. 첫 동기화는 알림 없이 현재 예약을 기준선으로 저장합니다. 캘린더에 예약이 보이면 성공.

**D. 자동 동기화와 카카오톡 알림** (설정 없음)

9. **GitHub Secrets 등록** (저장소 → Settings → Secrets and variables → Actions). 2026-10-01 기준 아직 하나도 등록돼 있지 않아 기존 감시도 매번 건너뛰고 있었습니다.
   | 이름 | 값 |
   |---|---|
   | `SUPABASE_URL` | `https://lahhmnietqojijbrxkyu.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → `service_role` 키 (anon 키 아님) |
   | `KAKAO_REST_KEY`, `KAKAO_REFRESH_TOKEN`, (선택) `KAKAO_CLIENT_SECRET` | `../docs/airbnb-kakao-alert.md` 3단계로 발급. 비워 두면 동기화만 하고 알림은 로그로만 남깁니다. |
   | `AIRBNB_ICAL_URL` | 등록하지 않아도 됩니다. 앱의 채널 연결이 이 역할을 대신합니다. |
10. GitHub Actions(`.github/workflows/airbnb-watch.yml`)가 `npm run sync`를 돌립니다. 스케줄은 10분이지만 GitHub가 한가한 저장소의 예약 실행을 늦춰서 실제로는 수십 분에서 몇 시간 간격이 될 수 있습니다. Actions 탭 → "Run workflow"로 수동 실행하면 바로 돕니다.
11. 8번 이후에 들어오는 새 예약·취소·날짜 변경은 카카오톡으로 옵니다. 기존 단일 감시(`../scripts/airbnb-watch.mjs`)는 `AIRBNB_ICAL_URL`이 없으면 자동으로 건너뛰므로 따로 끌 것이 없습니다.

## 동작 원리

- 앱의 "지금 동기화"와 크론 스크립트(`scripts/sync-ical.mjs`)는 같은 엔진(`src/lib/sync/engine.mjs`)을 씁니다. 앱은 로그인 사용자의 권한(RLS)으로, 스크립트는 service_role 키로 실행됩니다.
- 예약 변화는 `booking_events`에 쌓이고 `notified_at`이 비어 있는 것만 크론이 카카오톡으로 보냅니다. 앱에서 동기화한 변화도 다음 크론 때 발송됩니다.
- 카카오 refresh token은 `app_state.kakao_refresh_token`에 보관되며 매 실행마다 갱신됩니다. 설정 방법은 `../docs/airbnb-kakao-alert.md` 3단계와 같습니다.

## 배포

Vercel에 `platform/` 디렉터리를 루트로 연결하고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 환경변수로 넣으면 됩니다. GitHub Pages(기존 정적 사이트)와는 별개로 배포합니다.

## 다음 할 일

- 게스트용 안내서 뷰어와 빌더 (PRD F2)
- 자동 메시지 템플릿 (F4), 청소·정비 할 일 (F5)
- 한국어 → 영·중·일 자동 번역 초안 채우기
- 우리 예약을 iCal로 내보내 OTA 재고 막기
