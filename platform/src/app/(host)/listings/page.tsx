import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LISTING_STATUS_LABEL, LISTING_TYPE_LABEL, type Listing } from "@/lib/types";

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("*").order("created_at");
  const listings = (data ?? []) as Listing[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">숙소</h1>
        <Link href="/listings/new" className="btn-primary">숙소 등록</Link>
      </div>
      {listings.length === 0 ? (
        <p className="card text-sm text-stone-500">등록된 숙소가 없어요.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr><th className="px-4 py-2">이름</th><th className="px-4 py-2">유형</th><th className="px-4 py-2">인원</th><th className="px-4 py-2">상태</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {listings.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 font-medium"><Link href={`/listings/${l.id}`} className="hover:underline">{l.name}</Link></td>
                  <td className="px-4 py-2.5">{LISTING_TYPE_LABEL[l.listing_type]}</td>
                  <td className="px-4 py-2.5">최대 {l.max_guests}명</td>
                  <td className="px-4 py-2.5"><span className="badge bg-stone-100 text-stone-700">{LISTING_STATUS_LABEL[l.status]}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/listings/${l.id}/calendar`} className="mr-3 underline">캘린더</Link>
                    <Link href={`/listings/${l.id}/channels`} className="underline">채널</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
