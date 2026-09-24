// 에어비앤비 캘린더(iCal)를 읽어 새 예약·취소·날짜 변경을 감지하고 카카오톡 "나에게 보내기"로 알립니다.
// GitHub Actions에서 10분마다 실행됩니다. 필요한 환경변수는 docs/airbnb-kakao-alert.md 참고.
const env = (k, required = true) => { const v = process.env[k]; if (!v && required) { console.log(`[skip] ${k} 미설정 — 설정 전까지 아무 것도 하지 않습니다.`); process.exit(0); } return v; };

const ICAL_URL = env('AIRBNB_ICAL_URL');
const SB_URL = env('SUPABASE_URL').replace(/\/$/, '');
const SB_KEY = env('SUPABASE_SERVICE_KEY');
const KAKAO_KEY = env('KAKAO_REST_KEY');
const KAKAO_SECRET = process.env.KAKAO_CLIENT_SECRET || '';
const SEED_REFRESH = process.env.KAKAO_REFRESH_TOKEN || '';
const SITE = process.env.SITE_URL || 'https://spaceurban.co.kr/stay/';

// ---------- Supabase (service role: RLS 우회, 서버에서만 사용) ----------
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${init.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
const getState = async (key) => (await sb(`app_state?key=eq.${encodeURIComponent(key)}&select=value`))[0]?.value ?? null;
const setState = (key, value) => sb('app_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });

// ---------- iCal ----------
function parseIcs(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').reduce((acc, l) => { if (/^[ \t]/.test(l) && acc.length) acc[acc.length - 1] += l.slice(1); else acc.push(l); return acc; }, []);
  const events = []; let cur = null;
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') { if (cur) events.push(cur); cur = null; }
    else if (cur) { const i = l.indexOf(':'); if (i < 0) continue; const key = l.slice(0, i).split(';')[0]; cur[key] = l.slice(i + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\;/g, ';'); }
  }
  return events.map((e) => {
    const d = (s) => s && `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const desc = e.DESCRIPTION || '';
    return {
      uid: e.UID, summary: e.SUMMARY || '', start_date: d(e.DTSTART), end_date: d(e.DTEND),
      reservation_url: (desc.match(/https?:\/\/\S+/) || [null])[0],
      phone_last4: (desc.match(/Last 4 Digits\)?:\s*(\d{4})/) || [null, null])[1],
    };
  }).filter((e) => e.uid && e.start_date);
}
const isReservation = (e) => /reserved/i.test(e.summary);
const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const fmt = (s) => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`; };
const range = (e) => `${fmt(e.start_date)} → ${fmt(e.end_date)} · ${nights(e.start_date, e.end_date)}박`;

// ---------- Kakao ----------
async function kakaoAccessToken() {
  const refresh = (await getState('kakao_refresh_token')) || SEED_REFRESH;
  if (!refresh) throw new Error('카카오 refresh token이 없습니다. docs/airbnb-kakao-alert.md 3단계를 진행하세요.');
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: KAKAO_KEY, refresh_token: refresh });
  if (KAKAO_SECRET) body.set('client_secret', KAKAO_SECRET);
  const r = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`카카오 토큰 갱신 실패: ${JSON.stringify(j)}`);
  if (j.refresh_token) await setState('kakao_refresh_token', j.refresh_token); // 만료 30일 전이면 새 refresh token이 내려옴 → 보관
  else if (!(await getState('kakao_refresh_token'))) await setState('kakao_refresh_token', refresh);
  return j.access_token;
}
async function kakaoSend(text, url) {
  const token = await kakaoAccessToken();
  const template = { object_type: 'text', text, link: { web_url: url || SITE, mobile_web_url: url || SITE }, button_title: url ? '예약 보기' : '스테이 보기' };
  const r = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams({ template_object: JSON.stringify(template) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.result_code !== 0) throw new Error(`카카오 전송 실패: ${r.status} ${JSON.stringify(j)}`);
}

// ---------- main ----------
const res = await fetch(ICAL_URL, { headers: { 'User-Agent': 'howstory-airbnb-watch/1.0' } });
if (!res.ok) throw new Error(`iCal 요청 실패 ${res.status}`);
const events = parseIcs(await res.text());
const reservations = events.filter(isReservation);
console.log(`iCal 이벤트 ${events.length}건, 그중 예약 ${reservations.length}건`);

const known = await sb('airbnb_events?select=uid,start_date,end_date,status');
const knownMap = new Map(known.map((k) => [k.uid, k]));
const seeded = await getState('airbnb_seeded');
const now = new Date().toISOString();
const alerts = [];

for (const e of reservations) {
  const k = knownMap.get(e.uid);
  if (!k) alerts.push({ kind: 'new', e });
  else if (k.status !== 'active') alerts.push({ kind: 'restored', e });
  else if (k.start_date !== e.start_date || k.end_date !== e.end_date) alerts.push({ kind: 'changed', e, prev: k });
  await sb('airbnb_events', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ ...e, status: 'active', last_seen: now, cancelled_at: null, ...(k ? {} : { first_seen: now }) }) });
}
const liveUids = new Set(reservations.map((e) => e.uid));
for (const k of known) {
  if (k.status === 'active' && !liveUids.has(k.uid) && new Date(k.end_date) >= new Date(now.slice(0, 10))) {
    alerts.push({ kind: 'cancelled', e: k });
    await sb(`airbnb_events?uid=eq.${encodeURIComponent(k.uid)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled', cancelled_at: now }) });
  }
}

if (!seeded) {
  await setState('airbnb_seeded', now);
  const upcoming = reservations.filter((e) => e.end_date >= now.slice(0, 10)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  await kakaoSend(`✅ 하우스토리 스테이 예약 감시를 시작했어요.\n현재 예약 ${upcoming.length}건${upcoming.length ? '\n' + upcoming.slice(0, 5).map(range).map((s) => '· ' + s).join('\n') : ''}\n\n앞으로 새 예약·취소·날짜 변경이 생기면 바로 알려 드릴게요.`);
  console.log('첫 실행: 현재 상태를 기준으로 저장하고 시작 메시지를 보냈습니다.');
  process.exit(0);
}

for (const a of alerts) {
  const phone = a.e.phone_last4 ? `\n게스트 연락처 끝자리 ${a.e.phone_last4}` : '';
  const text = a.kind === 'new' ? `🏠 새 예약이 들어왔어요!\n${range(a.e)}${phone}`
    : a.kind === 'cancelled' ? `❌ 예약이 취소됐어요.\n${range(a.e)}`
    : a.kind === 'changed' ? `🔁 예약 날짜가 바뀌었어요.\n이전: ${range(a.prev)}\n변경: ${range(a.e)}${phone}`
    : `↩️ 취소됐던 예약이 다시 잡혔어요.\n${range(a.e)}${phone}`;
  await kakaoSend(`[하우스토리 스테이]\n${text}`, a.e.reservation_url);
  console.log(`알림 전송: ${a.kind} ${a.e.uid}`);
}
if (!alerts.length) console.log('변화 없음.');
