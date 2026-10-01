// 채널 iCal 동기화 엔진. 브라우저 세션(RLS 적용)과 service_role(스크립트) 두 경우 모두 같은 supabase-js 클라이언트 인터페이스로 동작한다.
// 순수 JS로 두어 Next 서버 액션(TS)과 scripts/sync-ical.mjs(Node)가 같은 코드를 쓴다.

/** iCal 텍스트를 VEVENT 배열로 푼다. (줄 접힘, 이스케이프 처리 포함) */
export function parseIcs(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").reduce((acc, l) => {
    if (/^[ \t]/.test(l) && acc.length) acc[acc.length - 1] += l.slice(1); else acc.push(l);
    return acc;
  }, []);
  const events = [];
  let cur = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") cur = {};
    else if (l === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const i = l.indexOf(":");
      if (i < 0) continue;
      cur[l.slice(0, i).split(";")[0]] = l.slice(i + 1).replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\;/g, ";");
    }
  }
  return events;
}

const toDate = (s) => (s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);

/** 채널별로 "예약"으로 볼 이벤트만 골라 공통 형태로 바꾼다. 막아둔 날짜(Not available 등)는 뺀다. */
export function toReservations(events, channel) {
  return events
    .map((e) => {
      const desc = e.DESCRIPTION || "";
      const summary = e.SUMMARY || "";
      return {
        external_uid: e.UID,
        summary,
        check_in: toDate(e.DTSTART),
        check_out: toDate(e.DTEND),
        reservation_url: (desc.match(/https?:\/\/\S+/) || [null])[0],
        guest_phone_last4: (desc.match(/Last 4 Digits\)?:\s*(\d{4})/) || [null, null])[1],
      };
    })
    .filter((r) => r.external_uid && r.check_in && r.check_out && r.check_out > r.check_in)
    .filter((r) => (channel === "airbnb" ? /reserved/i.test(r.summary) : !/not available|unavailable|blocked|closed/i.test(r.summary)));
}

/**
 * 채널 소스 하나를 동기화한다.
 * @param db supabase-js 클라이언트
 * @param source channel_sources 행
 * @returns { total, alerts:[{kind, booking, prev?}], seeded, error? }
 */
export async function runSourceSync(db, source, fetchImpl = fetch) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const fail = async (msg) => {
    await db.from("channel_sources").update({ last_error: msg }).eq("id", source.id);
    return { total: 0, alerts: [], seeded: false, error: msg };
  };

  let text;
  try {
    const res = await fetchImpl(source.ical_url, { headers: { "User-Agent": "howstory-sync/1.0" } });
    if (!res.ok) return fail(`iCal 요청 실패 ${res.status}`);
    text = await res.text();
  } catch (e) {
    return fail(`iCal 요청 오류: ${e?.message ?? e}`);
  }
  if (!/BEGIN:VCALENDAR/.test(text)) return fail("iCal 형식이 아닙니다. 주소를 확인하세요.");

  const live = toReservations(parseIcs(text), source.channel);
  const { data: knownRows, error: kErr } = await db.from("bookings").select("*").eq("source_id", source.id);
  if (kErr) return fail(`예약 조회 실패: ${kErr.message}`);
  const known = new Map((knownRows ?? []).map((k) => [k.external_uid, k]));
  const seeded = !source.last_synced_at; // 첫 동기화: 알림 없이 기준선만 저장
  const alerts = [];

  for (const r of live) {
    const k = known.get(r.external_uid);
    let kind = null;
    if (!k) kind = "new";
    else if (k.status !== "active") kind = "restored";
    else if (k.check_in !== r.check_in || k.check_out !== r.check_out) kind = "changed";

    const row = {
      listing_id: source.listing_id, source_id: source.id, origin: "channel", external_uid: r.external_uid,
      check_in: r.check_in, check_out: r.check_out, reservation_url: r.reservation_url, guest_phone_last4: r.guest_phone_last4,
      status: "active", last_seen_at: now, cancelled_at: null, ...(k ? {} : { first_seen_at: now }),
    };
    const { data: saved, error } = await db.from("bookings").upsert(row, { onConflict: "source_id,external_uid" }).select("*").single();
    if (error) return fail(`예약 저장 실패: ${error.message}`);
    if (kind && !seeded) alerts.push({ kind, booking: saved, prev: k ?? null });
  }

  const liveUids = new Set(live.map((r) => r.external_uid));
  for (const k of knownRows ?? []) {
    if (k.status === "active" && !liveUids.has(k.external_uid) && k.check_out >= today) {
      const { data: saved } = await db.from("bookings").update({ status: "cancelled", cancelled_at: now, last_seen_at: now }).eq("id", k.id).select("*").single();
      if (!seeded) alerts.push({ kind: "cancelled", booking: saved ?? { ...k, status: "cancelled" }, prev: k });
    }
  }

  if (alerts.length) {
    await db.from("booking_events").insert(alerts.map((a) => ({
      booking_id: a.booking.id, listing_id: source.listing_id, kind: a.kind,
      detail: a.prev ? { prev_check_in: a.prev.check_in, prev_check_out: a.prev.check_out } : null,
    })));
  }
  await db.from("channel_sources").update({ last_synced_at: now, last_error: null }).eq("id", source.id);
  return { total: live.length, alerts, seeded };
}

// ---------- 알림 문구 ----------
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const fmt = (s) => { const d = new Date(s + "T00:00:00"); return `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})`; };
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const fmtRange = (ci, co) => `${fmt(ci)} → ${fmt(co)} · ${nightsOf(ci, co)}박`;

/** booking_events 행 + 예약 + 숙소 이름으로 카카오톡 문구를 만든다. */
export function formatEventMessage(ev, booking, listingName) {
  const phone = booking.guest_phone_last4 ? `\n게스트 연락처 끝자리 ${booking.guest_phone_last4}` : "";
  const range = fmtRange(booking.check_in, booking.check_out);
  const prev = ev.detail?.prev_check_in ? fmtRange(ev.detail.prev_check_in, ev.detail.prev_check_out) : null;
  const body =
    ev.kind === "new" ? `🏠 새 예약이 들어왔어요!\n${range}${phone}`
    : ev.kind === "cancelled" ? `❌ 예약이 취소됐어요.\n${range}`
    : ev.kind === "changed" ? `🔁 예약 날짜가 바뀌었어요.\n이전: ${prev}\n변경: ${range}${phone}`
    : ev.kind === "restored" ? `↩️ 취소됐던 예약이 다시 잡혔어요.\n${range}${phone}`
    : ev.kind === "manual_created" ? `📝 예약을 직접 추가했어요.\n${range}`
    : `📝 직접 추가한 예약을 취소했어요.\n${range}`;
  return { text: `[하우-스토리 · ${listingName}]\n${body}`, url: booking.reservation_url || null };
}
