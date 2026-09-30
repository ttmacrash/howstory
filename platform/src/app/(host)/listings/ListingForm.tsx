import { LISTING_STATUS_LABEL, LISTING_TYPE_LABEL, type Listing } from "@/lib/types";

/** 숙소 기본 정보 폼. 등록과 수정에서 같이 쓴다. */
export function ListingForm({ listing, action, submitLabel }: { listing?: Listing; action: (fd: FormData) => Promise<void>; submitLabel: string }) {
  const l = listing;
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">숙소 이름 (호스트용)</label>
          <input id="name" name="name" required defaultValue={l?.name ?? ""} className="input" placeholder="예: 스페이스어반 스테이" />
        </div>
        <div>
          <label className="label" htmlFor="listing_type">유형</label>
          <select id="listing_type" name="listing_type" defaultValue={l?.listing_type ?? "entire_home"} className="input">
            {Object.entries(LISTING_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">상태</label>
          <select id="status" name="status" defaultValue={l?.status ?? "draft"} className="input">
            {Object.entries(LISTING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:col-span-2">
          <div><label className="label" htmlFor="max_guests">최대 인원</label><input id="max_guests" name="max_guests" type="number" min={1} defaultValue={l?.max_guests ?? 2} className="input" /></div>
          <div><label className="label" htmlFor="bedrooms">침실</label><input id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={l?.bedrooms ?? 1} className="input" /></div>
          <div><label className="label" htmlFor="beds">침대</label><input id="beds" name="beds" type="number" min={0} defaultValue={l?.beds ?? 1} className="input" /></div>
          <div><label className="label" htmlFor="bathrooms">욕실</label><input id="bathrooms" name="bathrooms" type="number" min={0} step={0.5} defaultValue={l?.bathrooms ?? 1} className="input" /></div>
        </div>
        <div className="sm:col-span-2"><label className="label" htmlFor="address_line1">주소</label><input id="address_line1" name="address_line1" defaultValue={l?.address_line1 ?? ""} className="input" placeholder="도로명 주소" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="address_line2">상세 주소</label><input id="address_line2" name="address_line2" defaultValue={l?.address_line2 ?? ""} className="input" placeholder="동·호수 (게스트에게는 예약 확정 후에만 보여줍니다)" /></div>
        <div><label className="label" htmlFor="city">시·군·구</label><input id="city" name="city" defaultValue={l?.city ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="region">시·도</label><input id="region" name="region" defaultValue={l?.region ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="checkin_time">체크인 시간</label><input id="checkin_time" name="checkin_time" type="time" defaultValue={(l?.checkin_time ?? "15:00").slice(0, 5)} className="input" /></div>
        <div><label className="label" htmlFor="checkout_time">체크아웃 시간</label><input id="checkout_time" name="checkout_time" type="time" defaultValue={(l?.checkout_time ?? "11:00").slice(0, 5)} className="input" /></div>
        <div><label className="label" htmlFor="min_nights">최소 숙박(박)</label><input id="min_nights" name="min_nights" type="number" min={1} defaultValue={l?.min_nights ?? 1} className="input" /></div>
        <div><label className="label" htmlFor="max_nights">최대 숙박(박, 비우면 제한 없음)</label><input id="max_nights" name="max_nights" type="number" min={1} defaultValue={l?.max_nights ?? ""} className="input" /></div>
      </div>
      <button type="submit" className="btn-primary">{submitLabel}</button>
    </form>
  );
}
