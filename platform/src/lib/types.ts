export type Locale = "ko" | "en" | "zh" | "ja";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
];

export type ListingStatus = "draft" | "review" | "published" | "paused" | "hidden";
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "작성 중", review: "심사 대기", published: "공개", paused: "일시 중지", hidden: "비공개",
};

export type ListingType = "entire_home" | "private_room" | "shared_room" | "hotel_room";
export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  entire_home: "집 전체", private_room: "개인실", shared_room: "다인실", hotel_room: "호텔 객실",
};

export type ChannelKind = "airbnb" | "yanolja" | "yeogieottae" | "booking" | "agoda" | "other";
export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  airbnb: "에어비앤비", yanolja: "야놀자", yeogieottae: "여기어때", booking: "부킹닷컴", agoda: "아고다", other: "기타",
};

export type Listing = {
  id: string; host_id: string; name: string; listing_type: ListingType; max_guests: number;
  bedrooms: number; beds: number; bathrooms: number;
  address_line1: string | null; address_line2: string | null; city: string | null; region: string | null;
  postal_code: string | null; country: string; lat: number | null; lng: number | null;
  checkin_time: string; checkout_time: string; min_nights: number; max_nights: number | null;
  status: ListingStatus; default_locale: Locale; created_at: string; updated_at: string;
};

export type ListingContent = {
  listing_id: string; locale: Locale; title: string | null; summary: string | null; description: string | null;
  house_rules: string | null; checkin_guide: string | null; is_machine_translated: boolean; source_version: number; updated_at: string;
};

export type ChannelSource = {
  id: string; listing_id: string; channel: ChannelKind; label: string | null; ical_url: string;
  is_active: boolean; last_synced_at: string | null; last_error: string | null; created_at: string;
};

export type Booking = {
  id: string; listing_id: string; source_id: string | null; origin: "channel" | "manual" | "direct"; external_uid: string | null;
  check_in: string; check_out: string; guest_name: string | null; guest_locale: string | null; guest_phone_last4: string | null;
  reservation_url: string | null; note: string | null; status: "active" | "cancelled";
  first_seen_at: string; last_seen_at: string; cancelled_at: string | null; created_by: string | null;
};
