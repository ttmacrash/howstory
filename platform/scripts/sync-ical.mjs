// 모든 활성 채널 소스를 동기화하고, 아직 알리지 않은 예약 변화를 카카오톡으로 보낸다.
// GitHub Actions에서 10분마다 실행. 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, (선택) KAKAO_REST_KEY, KAKAO_CLIENT_SECRET, KAKAO_REFRESH_TOKEN
import { createClient } from "@supabase/supabase-js";
import { runSourceSync, formatEventMessage } from "../src/lib/sync/engine.mjs";
import { createKakao } from "../src/lib/sync/kakao.mjs";

const env = (k) => process.env[k] || "";
if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_KEY")) { console.log("[skip] SUPABASE_URL / SUPABASE_SERVICE_KEY 미설정"); process.exit(0); }

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } });
const kakao = env("KAKAO_REST_KEY") ? createKakao({ db, restKey: env("KAKAO_REST_KEY"), clientSecret: env("KAKAO_CLIENT_SECRET"), seedRefreshToken: env("KAKAO_REFRESH_TOKEN"), siteUrl: env("SITE_URL") || undefined }) : null;

// 1) 동기화
const { data: sources, error } = await db.from("channel_sources").select("*").eq("is_active", true);
if (error) throw error;
if (!sources?.length) { console.log("활성 채널 소스가 없습니다. 앱에서 숙소 → 채널 연결을 먼저 하세요."); }
let failures = 0;
for (const s of sources ?? []) {
  const r = await runSourceSync(db, s);
  if (r.error) { failures++; console.log(`[${s.channel}] ${s.id} 실패: ${r.error}`); }
  else console.log(`[${s.channel}] ${s.id} 예약 ${r.total}건${r.seeded ? " (첫 동기화, 기준선 저장)" : `, 변화 ${r.alerts.length}건`}`);
}

// 2) 미발송 알림
const { data: pending } = await db.from("booking_events").select("*, bookings(*), listings(name)").is("notified_at", null).order("created_at").limit(50);
if (!pending?.length) console.log("보낼 알림 없음.");
for (const ev of pending ?? []) {
  const { text, url } = formatEventMessage(ev, ev.bookings, ev.listings?.name ?? "숙소");
  if (!kakao) { console.log("(카카오 미설정) " + text.replace(/\n/g, " / ")); continue; }
  try {
    await kakao.send(text, url);
    await db.from("booking_events").update({ notified_at: new Date().toISOString() }).eq("id", ev.id);
    console.log(`알림 전송: ${ev.kind} ${ev.booking_id}`);
  } catch (e) {
    failures++; console.log(`알림 실패: ${e.message}`);
  }
}
if (failures) process.exit(1);
