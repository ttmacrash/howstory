import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtRange, todayISO, fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL, LISTING_STATUS_LABEL, type Booking, type ChannelSource, type Listing } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: listings }, { data: bookings }, { data: conflicts }, { data: sources }] = await Promise.all([
    supabase.from("listings").select("*").order("created_at"),
    supabase.from("bookings").select("*").eq("status", "active").gte("check_out", today).order("check_in").limit(30),
    supabase.from("booking_conflicts").select("*"),
    supabase.from("channel_sources").select("*").eq("is_active", true),
  ]);
  const ls = (listings ?? []) as Listing[];
  const bs = (bookings ?? []) as Booking[];
  const srcs = (sources ?? []) as ChannelSource[];
  const nameOf = (id: string) => ls.find((l) => l.id === id)?.name ?? "숙소";
  const sourceOf = (id: string | null) => srcs.find((s) => s.id === id);
  const conflictIds = new Set((conflicts ?? []).flatMap((c: { booking_id: string; other_booking_id: string }) => [c.booking_id, c.other_booking_id]));

  if (ls.length === 0) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-lg font-bold">첫 숙소를 등록해 주세요</h1>
        <p className="mt-2 text-sm text-stone-600">숙소를 등록하면 에어비앤비 같은 외부 채널의 예약을 한 캘린더에서 볼 수 있어요.</p>
        <Link href="/listings/new" className="btn-primary mt-4">숙소 등록</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold">대시보드</h1>
        <span className="text-xs text-stone-500">오늘 {today}</span>
      </div>

      {conflictIds.size > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <b>날짜가 겹치는 예약이 {conflictIds.size}건 있어요.</b> 아래 목록에서 빨간 표시를 확인하고 한쪽을 취소하거나 채널에서 정리해 주세요.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ls.map((l) => {
          const mine = bs.filter((b) => b.listing_id === l.id);
          const lsrc = srcs.filter((s) => s.listing_id === l.id);
          return (
            <div key={l.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/listings/${l.id}`} className="font-semibold hover:underline">{l.name}</Link>
                <span className="badge bg-stone-100 text-stone-700">{LISTING_STATUS_LABEL[l.status]}</span>
              </div>
              <div className="mt-2 text-sm text-stone-600">다가오는 예약 {mine.length}건 · 연결 채널 {lsrc.length}개</div>
              <div className="mt-1 text-xs text-stone-500">
                {lsrc.length ? lsrc.map((s) => `${CHANNEL_LABEL[s.channel]} ${fmtDateTime(s.last_synced_at)}`).join(" · ") : "채널 미연결"}
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/listings/${l.id}/calendar`} className="btn-secondary !py-1">캘린더</Link>
                <Link href={`/listings/${l.id}/channels`} className="btn-secondary !py-1">채널</Link>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">다가오는 예약</h2>
        {bs.length === 0 ? (
          <p className="text-sm text-stone-500">아직 예약이 없어요. 채널을 연결하거나 캘린더에서 직접 추가해 보세요.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {bs.map((b) => {
              const src = sourceOf(b.source_id);
              const bad = conflictIds.has(b.id);
              return (
                <li key={b.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${bad ? "text-red-700" : ""}`}>
                  <div>
                    <span className="font-medium">{fmtRange(b.check_in, b.check_out)}</span>
                    <span className="ml-2 text-stone-500">{nameOf(b.listing_id)}</span>
                    {bad && <span className="badge ml-2 bg-red-100 text-red-700">겹침</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="badge bg-stone-100 text-stone-700">{src ? CHANNEL_LABEL[src.channel] : b.origin === "manual" ? "직접 입력" : "직접 예약"}</span>
                    {b.guest_name && <span>{b.guest_name}</span>}
                    {b.guest_phone_last4 && <span>연락처 끝 {b.guest_phone_last4}</span>}
                    {b.reservation_url && <a href={b.reservation_url} target="_blank" rel="noreferrer" className="underline">예약 보기</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
