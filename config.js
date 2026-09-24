// 하우스토리 사이트 설정. 어드민(Supabase)에 신청을 저장하려면 아래 두 값을 채우세요. 비우면 메일(Formspree)로만 갑니다.
window.HOWSTORY_CONFIG = {
  SUPABASE_URL: "https://lahhmnietqojijbrxkyu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_pskU5HwPACSLTVMVAgCZhQ_pM5W4KVT"
};

// 스테이 숙소 기준값. 에어비앤비 숙소 페이지와 항상 같게 유지하세요. (홈·예약 페이지가 모두 이 값을 읽습니다)
window.HOWSTORY_STAY = {
  AIRBNB_URL: "https://www.airbnb.co.kr/rooms/1714436404764677191",
  MAX_GUESTS: 5,      // 최대 인원
  MIN_NIGHTS: 2,      // 최소 숙박(박)
  PRICE_FROM: null    // 1박 기준 요금(원). 예: 150000 → 홈에 "1박 150,000원부터" 표시. null이면 "요금은 에어비앤비에서 확인"으로 표시
};
