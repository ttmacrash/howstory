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

## 처음 설정

1. **DB**: Supabase → SQL Editor에서 `supabase/migrations/0001_init.sql` 실행. 기존 `airbnb_events`, `app_state` 표는 그대로 둡니다.
2. **Auth**: Supabase → Authentication → Providers → Email 켜기. URL Configuration의 Redirect URLs에 `http://localhost:3000/auth/confirm` 과 배포 주소의 `/auth/confirm` 추가. 개발 중에는 "Confirm email"을 끄면 가입 즉시 로그인됩니다.
3. **환경변수**: `.env.example`을 `.env.local`로 복사해 채웁니다. 공개 키(`NEXT_PUBLIC_*`)만 앱에 필요하고, `SUPABASE_SERVICE_KEY`와 카카오 값은 동기화 스크립트에만 필요합니다.
4. 실행:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```

## 동기화와 알림

- 앱에서 채널을 추가하고 **지금 동기화**를 누르면 첫 동기화는 알림 없이 현재 예약을 기준선으로 저장합니다.
- 이후 변화(새 예약·취소·날짜 변경·복구)는 `booking_events`에 쌓이고, GitHub Actions(`.github/workflows/airbnb-watch.yml`)가 10분마다 `npm run sync`로 동기화 + 카카오톡 발송을 합니다.
- 카카오 설정은 `../docs/airbnb-kakao-alert.md` 3단계와 같습니다. refresh token은 `app_state.kakao_refresh_token`에 보관됩니다.
- 기존 단일 캘린더 감시(`../scripts/airbnb-watch.mjs`)는 당분간 같이 돌아갑니다. 앱에서 에어비앤비 채널을 연결한 뒤 `AIRBNB_ICAL_URL` 시크릿을 지우면 기존 방식은 자동으로 건너뜁니다.

## 배포

Vercel에 `platform/` 디렉터리를 루트로 연결하고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 환경변수로 넣으면 됩니다. GitHub Pages(기존 정적 사이트)와는 별개로 배포합니다.

## 다음 할 일

- 게스트용 안내서 뷰어와 빌더 (PRD F2)
- 자동 메시지 템플릿 (F4), 청소·정비 할 일 (F5)
- 한국어 → 영·중·일 자동 번역 초안 채우기
- 우리 예약을 iCal로 내보내 OTA 재고 막기
