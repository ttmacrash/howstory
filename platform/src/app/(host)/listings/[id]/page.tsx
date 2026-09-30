import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALES, type Listing, type ListingContent, type Locale } from "@/lib/types";
import { saveContent, updateListing } from "../actions";
import { ListingForm } from "../ListingForm";

export default async function ListingEditPage(props: PageProps<"/listings/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const message = typeof sp.message === "string" ? sp.message : "";
  const locale = (LOCALES.some((l) => l.code === sp.locale) ? sp.locale : "ko") as Locale;

  const supabase = await createClient();
  const [{ data: listing }, { data: contents }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase.from("listing_contents").select("*").eq("listing_id", id),
  ]);
  if (!listing) notFound();
  const l = listing as Listing;
  const cs = (contents ?? []) as ListingContent[];
  const c = cs.find((x) => x.locale === locale);
  const ko = cs.find((x) => x.locale === "ko");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{l.name}</h1>
        <div className="flex gap-2">
          <Link href={`/listings/${id}/calendar`} className="btn-secondary">캘린더</Link>
          <Link href={`/listings/${id}/channels`} className="btn-secondary">채널 연결</Link>
        </div>
      </div>
      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

      <section className="card">
        <h2 className="mb-4 font-semibold">기본 정보</h2>
        <ListingForm listing={l} action={updateListing.bind(null, id)} submitLabel="저장" />
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">소개 · 규칙 (언어별)</h2>
          <div className="flex rounded-lg bg-stone-100 p-1 text-sm">
            {LOCALES.map((x) => {
              const has = cs.some((y) => y.locale === x.code && (y.title || y.description));
              return (
                <Link key={x.code} href={`/listings/${id}?locale=${x.code}`} className={`rounded-md px-3 py-1 ${locale === x.code ? "bg-white font-semibold shadow-sm" : "text-stone-500"}`}>
                  {x.label}{has ? "" : " ·"}
                </Link>
              );
            })}
          </div>
        </div>
        {locale !== "ko" && ko?.description && (
          <details className="mb-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
            <summary className="cursor-pointer font-medium">한국어 원문 보기</summary>
            <p className="mt-2 whitespace-pre-wrap">{ko.description}</p>
          </details>
        )}
        <form action={saveContent.bind(null, id, locale)} className="space-y-4">
          <div><label className="label" htmlFor="title">숙소 제목 (게스트에게 보이는 이름)</label><input id="title" name="title" defaultValue={c?.title ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="summary">한 줄 소개</label><input id="summary" name="summary" defaultValue={c?.summary ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="description">상세 설명</label><textarea id="description" name="description" rows={6} defaultValue={c?.description ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="house_rules">하우스 룰</label><textarea id="house_rules" name="house_rules" rows={4} defaultValue={c?.house_rules ?? ""} className="input" /></div>
          <div><label className="label" htmlFor="checkin_guide">체크인 안내</label><textarea id="checkin_guide" name="checkin_guide" rows={4} defaultValue={c?.checkin_guide ?? ""} className="input" placeholder="도어록 사용법, 주차, 찾아오는 길" /></div>
          {locale !== "ko" && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" name="is_machine_translated" defaultChecked={c?.is_machine_translated ?? false} /> 자동 번역 초안 (호스트 검수 전)
            </label>
          )}
          <button type="submit" className="btn-primary">{LOCALES.find((x) => x.code === locale)?.label} 저장</button>
        </form>
      </section>
    </div>
  );
}
