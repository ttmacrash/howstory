"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runSourceSync } from "@/lib/sync/engine.mjs";
import type { Locale } from "@/lib/types";

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };
const num = (fd: FormData, k: string, d: number) => { const n = Number(str(fd, k)); return Number.isFinite(n) && str(fd, k) !== "" ? n : d; };
const nul = (s: string) => (s === "" ? null : s);

function listingFields(fd: FormData) {
  return {
    name: str(fd, "name"),
    listing_type: str(fd, "listing_type") || "entire_home",
    max_guests: num(fd, "max_guests", 2),
    bedrooms: num(fd, "bedrooms", 1),
    beds: num(fd, "beds", 1),
    bathrooms: num(fd, "bathrooms", 1),
    address_line1: nul(str(fd, "address_line1")),
    address_line2: nul(str(fd, "address_line2")),
    city: nul(str(fd, "city")),
    region: nul(str(fd, "region")),
    postal_code: nul(str(fd, "postal_code")),
    checkin_time: str(fd, "checkin_time") || "15:00",
    checkout_time: str(fd, "checkout_time") || "11:00",
    min_nights: num(fd, "min_nights", 1),
    max_nights: str(fd, "max_nights") ? num(fd, "max_nights", 0) : null,
    status: str(fd, "status") || "draft",
  };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createListing(fd: FormData) {
  const { supabase, user } = await requireUser();
  const fields = listingFields(fd);
  if (!fields.name) redirect("/listings/new?message=" + encodeURIComponent("숙소 이름을 입력해 주세요."));
  const { data, error } = await supabase.from("listings").insert({ ...fields, host_id: user.id }).select("id").single();
  if (error || !data) redirect("/listings/new?message=" + encodeURIComponent("저장에 실패했습니다: " + (error?.message ?? "")));
  // 한국어 콘텐츠 행을 만들어 두고, 제목은 내부 이름으로 시작한다.
  await supabase.from("listing_contents").insert({ listing_id: data.id, locale: "ko", title: fields.name });
  redirect(`/listings/${data.id}`);
}

export async function updateListing(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const fields = listingFields(fd);
  const { error } = await supabase.from("listings").update(fields).eq("id", id);
  revalidatePath(`/listings/${id}`);
  redirect(`/listings/${id}?message=` + encodeURIComponent(error ? "저장 실패: " + error.message : "저장했습니다."));
}

export async function saveContent(id: string, locale: Locale, fd: FormData) {
  const { supabase } = await requireUser();
  const row = {
    listing_id: id, locale,
    title: nul(str(fd, "title")), summary: nul(str(fd, "summary")), description: nul(str(fd, "description")),
    house_rules: nul(str(fd, "house_rules")), checkin_guide: nul(str(fd, "checkin_guide")),
    is_machine_translated: fd.get("is_machine_translated") === "on",
  };
  const { error } = await supabase.from("listing_contents").upsert(row, { onConflict: "listing_id,locale" });
  revalidatePath(`/listings/${id}`);
  redirect(`/listings/${id}?locale=${locale}&message=` + encodeURIComponent(error ? "저장 실패: " + error.message : "저장했습니다."));
}

export async function addChannelSource(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const ical_url = str(fd, "ical_url");
  const back = (m: string) => redirect(`/listings/${id}/channels?message=` + encodeURIComponent(m));
  if (!/^https?:\/\/.+\.ics(\?.*)?$/i.test(ical_url) && !/^https?:\/\/.+/.test(ical_url)) back("iCal 주소를 확인해 주세요.");
  const { error } = await supabase.from("channel_sources").insert({
    listing_id: id, channel: str(fd, "channel") || "other", label: nul(str(fd, "label")), ical_url,
  });
  if (error) back("추가 실패: " + error.message);
  revalidatePath(`/listings/${id}/channels`);
  back("채널을 추가했어요. '지금 동기화'를 누르면 기준선을 저장합니다.");
}

export async function toggleChannelSource(id: string, sourceId: string, active: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("channel_sources").update({ is_active: active }).eq("id", sourceId);
  revalidatePath(`/listings/${id}/channels`);
  redirect(`/listings/${id}/channels`);
}

export async function deleteChannelSource(id: string, sourceId: string) {
  const { supabase } = await requireUser();
  await supabase.from("channel_sources").delete().eq("id", sourceId);
  revalidatePath(`/listings/${id}/channels`);
  redirect(`/listings/${id}/channels?message=` + encodeURIComponent("채널을 삭제했어요. 이 채널에서 들어온 예약은 남아 있습니다."));
}

export async function syncChannelSourceNow(id: string, sourceId: string) {
  const { supabase } = await requireUser();
  const { data: source } = await supabase.from("channel_sources").select("*").eq("id", sourceId).single();
  const back = (m: string) => redirect(`/listings/${id}/channels?message=` + encodeURIComponent(m));
  if (!source) back("채널을 찾을 수 없어요.");
  const r = await runSourceSync(supabase, source);
  revalidatePath(`/listings/${id}/channels`);
  revalidatePath(`/listings/${id}/calendar`);
  revalidatePath("/dashboard");
  if (r.error) back("동기화 실패: " + r.error);
  back(r.seeded ? `첫 동기화: 예약 ${r.total}건을 기준선으로 저장했어요.` : `동기화 완료: 예약 ${r.total}건, 변화 ${r.alerts.length}건.`);
}

export async function addManualBooking(id: string, fd: FormData) {
  const { supabase, user } = await requireUser();
  const check_in = str(fd, "check_in"), check_out = str(fd, "check_out");
  const month = check_in.slice(0, 7);
  const back = (m: string) => redirect(`/listings/${id}/calendar?month=${month}&message=` + encodeURIComponent(m));
  if (!check_in || !check_out || check_out <= check_in) back("체크인·체크아웃 날짜를 확인해 주세요.");
  const { error } = await supabase.from("bookings").insert({
    listing_id: id, origin: "manual", check_in, check_out, created_by: user.id,
    guest_name: nul(str(fd, "guest_name")), guest_locale: nul(str(fd, "guest_locale")), note: nul(str(fd, "note")),
  });
  if (error) back("추가 실패: " + error.message);
  revalidatePath(`/listings/${id}/calendar`);
  back("예약을 추가했어요.");
}

export async function cancelBooking(id: string, bookingId: string, month: string) {
  const { supabase } = await requireUser();
  await supabase.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", bookingId);
  revalidatePath(`/listings/${id}/calendar`);
  redirect(`/listings/${id}/calendar?month=${month}&message=` + encodeURIComponent("예약을 취소 처리했어요."));
}
