import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, fmtRange, todayISO } from "@/lib/format";
import { CHANNEL_LABEL, type Booking, type ChannelSource, type Listing } from "@/lib/types";
import { addManualBooking, cancelBooking } from "../../actions";

const COLORS = ["bg-sky-200 text-sky-900", "bg-emerald-200 text-emerald-900", "bg-violet-200 text-violet-900", "bg-amber-200 text-amber-900", "bg-rose-200 text-rose-900"];

function monthGrid(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  return days;
}
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarPage(props: PageProps<"/listings/[id]/calendar">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const message = typeof sp.message === "string" ? sp.message : "";
  const today = todayISO();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const days = monthGrid(month);

  const supabase = await createClient();
  const [{ data: listing }, { data: bookings }, { data: sources }, { data: conflicts }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("*").eq("listing_id", id).eq("status", "active").lt("check_in", addDays(days[41], 1)).gt("check_out", days[0]).order("check_in"),
    supabase.from("channel_sources").select("*").eq("listing_id", id),
    supabase.from("booking_conflicts").select("*").eq("listing_id", id),
  ]);
  if (!listing) notFound();
  const l = listing as Listing;
  const bs = (bookings ?? []) as Booking[];
  const srcs = (sources ?? []) as ChannelSource[];
  const conflictIds = new Set((conflicts ?? []).flatMap((c: { booking_id: string; other_booking_id: string }) => [c.booking_id, c.other_booking_id]));
  const colorOf = (b: Booking) => (conflictIds.has(b.id) ? "bg-red-200 text-red-900" : COLORS[Math.abs(hash(b.id)) % COLORS.length]);
  const channelOf = (b: Booking) => { const s = srcs.find((x) => x.id === b.source_id); return s ? CHANNEL_LABEL[s.channel] : b.origin === "manual" ? "직접 입력" : "직접 예약"; };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/listings/${id}`} className="text-sm text-stone-500 hover:underline">{l.name}</Link>
          <h1 className="text-xl font-bold">통합 캘린더</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?month=${shiftMonth(month, -1)}`} className="btn-secondary">‹</Link>
          <span className="w-24 text-center font-semibold">{month.replace("-", "년 ")}월</span>
          <Link href={`?month=${shiftMonth(month, 1)}`} className="btn-secondary">›</Link>
          <Link href={`?month=${today.slice(0, 7)}`} className="btn-secondary">오늘</Link>
        </div>
      </div>
      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d.startsWith(month);
            // 그 날 밤에 묵는 예약: check_in <= d < check_out
            const stays = bs.filter((b) => b.check_in <= d && d < b.check_out);
            return (
              <div key={d} className={`min-h-20 border-b border-r border-stone-100 p-1 text-xs ${inMonth ? "" : "bg-stone-50 text-stone-400"} ${d === today ? "ring-2 ring-inset ring-stone-400" : ""}`}>
                <div className="mb-1 text-right">{Number(d.slice(8))}</div>
                {stays.map((b) => (
                  <div key={b.id} title={`${fmtRange(b.check_in, b.check_out)} · ${channelOf(b)}`} className={`mb-0.5 truncate rounded px-1 py-0.5 ${colorOf(b)} ${b.check_in === d ? "rounded-l-md font-semibold" : ""}`}>
                    {b.check_in === d ? (b.guest_name || channelOf(b)) : "·"}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">이 달의 예약</h2>
          {bs.length === 0 ? <p className="text-sm text-stone-500">예약이 없어요.</p> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {bs.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className={conflictIds.has(b.id) ? "text-red-700" : ""}>
                    <div className="font-medium">{fmtRange(b.check_in, b.check_out)} {conflictIds.has(b.id) && <span className="badge ml-1 bg-red-100 text-red-700">겹침</span>}</div>
                    <div className="text-xs text-stone-500">{channelOf(b)}{b.guest_name ? ` · ${b.guest_name}` : ""}{b.guest_phone_last4 ? ` · 연락처 끝 ${b.guest_phone_last4}` : ""}{b.note ? ` · ${b.note}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.reservation_url && <a href={b.reservation_url} target="_blank" rel="noreferrer" className="text-xs underline">예약 보기</a>}
                    {b.origin !== "channel" && (
                      <form action={cancelBooking.bind(null, id, b.id, month)}><button className="btn-danger !py-1 text-xs">취소</button></form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-500">채널에서 들어온 예약은 그 채널에서 취소해야 해요. 다음 동기화 때 자동으로 반영됩니다.</p>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">예약 직접 추가</h2>
          <p className="mb-3 text-xs text-stone-500">전화·지인 예약처럼 채널에 없는 예약을 넣어 두면 날짜 겹침을 막을 수 있어요.</p>
          <form action={addManualBooking.bind(null, id)} className="grid grid-cols-2 gap-3 text-sm">
            <div><label className="label" htmlFor="check_in">체크인</label><input id="check_in" name="check_in" type="date" required className="input" /></div>
            <div><label className="label" htmlFor="check_out">체크아웃</label><input id="check_out" name="check_out" type="date" required className="input" /></div>
            <div><label className="label" htmlFor="guest_name">게스트 이름</label><input id="guest_name" name="guest_name" className="input" /></div>
            <div><label className="label" htmlFor="guest_locale">게스트 언어</label>
              <select id="guest_locale" name="guest_locale" className="input" defaultValue="ko"><option value="ko">한국어</option><option value="en">English</option><option value="zh">中文</option><option value="ja">日本語</option></select></div>
            <div className="col-span-2"><label className="label" htmlFor="note">메모</label><input id="note" name="note" className="input" placeholder="예: 늦은 체크인 요청" /></div>
            <div className="col-span-2"><button type="submit" className="btn-primary">추가</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
