# 에어비앤비 예약 → 카카오톡 알림 설정

에어비앤비 캘린더(iCal)를 GitHub Actions가 10분마다 읽어, **새 예약 · 취소 · 날짜 변경**이 생기면 카카오톡으로 알려 줍니다.
카카오톡은 "나에게 보내기" API를 쓰므로 심사 없이 바로 되고, **카카오 앱을 만든 계정 본인**에게 옵니다.

한 번만 설정하면 됩니다. 순서대로 20분쯤 걸립니다.

## 1. 에어비앤비 캘린더 내보내기 링크 받기 (호스트 계정)

1. 에어비앤비 호스트 모드 → **캘린더** → 숙소 선택 → 오른쪽 **사용 가능 여부 설정**(또는 설정 아이콘)
2. **캘린더 연결 → 캘린더 내보내기**
3. `https://www.airbnb.co.kr/calendar/ical/1714436404764677191.ics?s=…` 형태의 링크를 복사합니다.
   - 숙소 페이지 주소(`/rooms/…`)가 아니라 **`.ics`로 끝나는 링크**여야 합니다.
   - 이 링크는 비밀번호와 같습니다. 채팅에 올리지 말고 5단계의 Secrets에만 넣으세요.

## 2. Supabase 표 만들기

1. Supabase 프로젝트 → **SQL Editor** → `docs/airbnb-alert.sql` 내용을 붙여넣고 실행
2. **Project Settings → API**에서 `service_role` 키를 복사합니다. (anon 키가 아닙니다. 이 키도 비밀입니다.)

## 3. 카카오 앱 만들기 (알림 받을 카카오 계정으로)

1. https://developers.kakao.com → **내 애플리케이션 → 애플리케이션 추가하기** (이름: 하우스토리 알림)
2. **앱 키**에서 **REST API 키** 복사
3. **카카오 로그인 → 활성화 ON**, **Redirect URI**에 `https://spaceurban.co.kr/kakao/` 추가
4. **카카오 로그인 → 동의항목**에서 **카카오톡 메시지 전송(talk_message)** 을 "선택 동의"로 설정
5. (보안 → Client Secret을 켰다면 그 값도 복사. 안 켜도 됩니다.)
6. 컴퓨터에서 refresh token 발급:
   ```bash
   node scripts/kakao-auth.mjs <REST_API_키> https://spaceurban.co.kr/kakao/
   ```
   출력된 주소를 브라우저에서 열고 동의 → 이동한 주소창에서 `code=` 뒤의 값을 복사 →
   ```bash
   node scripts/kakao-auth.mjs <REST_API_키> https://spaceurban.co.kr/kakao/ <복사한_code>
   ```
   `KAKAO_REFRESH_TOKEN = …` 이 출력됩니다. (code는 몇 분 안에 써야 합니다.)

## 4. (선택) 알림 받는 사람 추가

"나에게 보내기"는 앱을 만든 계정 한 명에게만 갑니다. 호스트 본인은 에어비앤비 앱 알림을 그대로 쓰면 되고,
다른 가족이 더 받으려면 그 사람 카카오 계정으로 3번을 한 번 더 해서 두 번째 토큰을 만드는 방식으로 확장할 수 있습니다.

## 5. GitHub Secrets 등록

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `AIRBNB_ICAL_URL` | 1단계 `.ics` 링크 |
| `SUPABASE_URL` | `https://lahhmnietqojijbrxkyu.supabase.co` |
| `SUPABASE_SERVICE_KEY` | 2단계 service_role 키 |
| `KAKAO_REST_KEY` | 3단계 REST API 키 |
| `KAKAO_REFRESH_TOKEN` | 3단계 refresh token |
| `KAKAO_CLIENT_SECRET` | (Client Secret을 켠 경우만) |

## 6. 첫 실행

GitHub → **Actions → "Airbnb 예약 감시 → 카카오톡 알림" → Run workflow**.
첫 실행은 현재 예약을 기준선으로 저장하고 "감시를 시작했어요" 메시지만 보냅니다. 이후 10분마다 자동 실행됩니다.

## 알림 예시

```
[하우스토리 스테이]
🏠 새 예약이 들어왔어요!
10월 1일(목) → 10월 3일(토) · 2박
게스트 연락처 끝자리 1234
[예약 보기]
```

## 알아 둘 것

- 에어비앤비 iCal에는 **날짜와 예약 상세 링크, 전화 끝 4자리**만 있고 게스트 이름·금액은 없습니다. "예약 보기" 버튼은 호스트 계정으로 로그인해야 열립니다.
- 에어비앤비가 iCal을 갱신하는 데 몇 분, GitHub 스케줄이 몇 분 늦을 수 있어 **예약 후 10~20분 안**에 옵니다.
- 카카오 refresh token은 60일짜리지만 감시 작업이 매번 갱신해 Supabase `app_state`에 보관하므로 만료되지 않습니다. 만약 "토큰 갱신 실패"로 작업이 빨개지면 3-6단계만 다시 하고 Secret을 바꾸면 됩니다.
- 작업이 실패하면 GitHub가 저장소 소유자 메일로 알려 줍니다. Secrets가 하나라도 비어 있으면 아무 것도 하지 않고 조용히 끝납니다.
