import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL, type ChannelSource, type Listing } from "@/lib/types";
import { addChannelSource, deleteChannelSource, syncChannelSourceNow, toggleChannelSource } from "../../actions";

export default async function ChannelsPage(props: PageProps<"/listings/[id]/channels">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const message = typeof sp.message === "string" ? sp.message : "";

  const supabase = await createClient();
  const [{ data: listing }, { data: sources }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase.from("channel_sources").select("*").eq("listing_id", id).order("created_at"),
  ]);
  if (!listing) notFound();
  const l = listing as Listing;
  const srcs = (sources ?? []) as ChannelSource[];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/listings/${id}`} className="text-sm text-stone-500 hover:underline">{l.name}</Link>
        <h1 className="text-xl font-bold">채널 연결</h1>
        <p className="mt-1 text-sm text-stone-600">에어비앤비 등 외부 채널의 캘린더 내보내기(iCal) 주소를 넣으면 예약을 읽어와 통합 캘린더에 합칩니다. 10분마다 자동 동기화됩니다.</p>
      </div>
      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

      <section className="card">
        <h2 className="mb-3 font-semibold">연결된 채널</h2>
        {srcs.length === 0 ? <p className="text-sm text-stone-500">아직 연결한 채널이 없어요.</p> : (
          <ul className="divide-y divide-stone-100 text-sm">
            {srcs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{CHANNEL_LABEL[s.channel]}{s.label ? ` · ${s.label}` : ""} {!s.is_active && <span className="badge ml-1 bg-stone-100 text-stone-600">중지됨</span>}</div>
                  <div className="truncate text-xs text-stone-500" title={s.ical_url}>{s.ical_url.replace(/\?.*$/, "?…")}</div>
                  <div className="text-xs text-stone-500">마지막 동기화 {fmtDateTime(s.last_synced_at)}{s.last_error ? <span className="ml-2 text-red-600">오류: {s.last_error}</span> : null}</div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={syncChannelSourceNow.bind(null, id, s.id)}><button className="btn-secondary !py-1 text-xs">지금 동기화</button></form>
                  <form action={toggleChannelSource.bind(null, id, s.id, !s.is_active)}><button className="btn-secondary !py-1 text-xs">{s.is_active ? "중지" : "다시 켜기"}</button></form>
                  <form action={deleteChannelSource.bind(null, id, s.id)}><button className="btn-danger !py-1 text-xs">삭제</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">채널 추가</h2>
        <form action={addChannelSource.bind(null, id)} className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
          <div>
            <label className="label" htmlFor="channel">채널</label>
            <select id="channel" name="channel" className="input" defaultValue="airbnb">
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="label">메모 (선택)</label><input id="label" name="label" className="input" placeholder="예: 호스트 계정 A" /></div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ical_url">iCal 주소</label>
            <input id="ical_url" name="ical_url" required className="input" placeholder="https://www.airbnb.co.kr/calendar/ical/….ics?s=…" />
            <p className="mt-1 text-xs text-stone-500">에어비앤비: 호스트 모드 → 캘린더 → 사용 가능 여부 설정 → 캘린더 연결 → 캘린더 내보내기. 이 주소는 비밀번호와 같으니 다른 곳에 올리지 마세요.</p>
          </div>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary">추가</button></div>
        </form>
      </section>
    </div>
  );
}
