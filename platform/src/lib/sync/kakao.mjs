// 카카오톡 "나에게 보내기". 기존 scripts/airbnb-watch.mjs 의 방식을 그대로 옮겼다.
// refresh token은 app_state 표의 kakao_refresh_token 에 보관하고 매번 갱신한다.

export function createKakao({ db, restKey, clientSecret = "", seedRefreshToken = "", siteUrl = "https://spaceurban.co.kr/stay/" }) {
  const getState = async (key) => (await db.from("app_state").select("value").eq("key", key).maybeSingle()).data?.value ?? null;
  const setState = (key, value) => db.from("app_state").upsert({ key, value, updated_at: new Date().toISOString() });

  async function accessToken() {
    const refresh = (await getState("kakao_refresh_token")) || seedRefreshToken;
    if (!refresh) throw new Error("카카오 refresh token이 없습니다. docs/airbnb-kakao-alert.md 3단계를 진행하세요.");
    const body = new URLSearchParams({ grant_type: "refresh_token", client_id: restKey, refresh_token: refresh });
    if (clientSecret) body.set("client_secret", clientSecret);
    const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body });
    const j = await r.json();
    if (!r.ok || !j.access_token) throw new Error(`카카오 토큰 갱신 실패: ${JSON.stringify(j)}`);
    if (j.refresh_token) await setState("kakao_refresh_token", j.refresh_token);
    else if (!(await getState("kakao_refresh_token"))) await setState("kakao_refresh_token", refresh);
    return j.access_token;
  }

  return {
    async send(text, url) {
      const token = await accessToken();
      const template = { object_type: "text", text, link: { web_url: url || siteUrl, mobile_web_url: url || siteUrl }, button_title: url ? "예약 보기" : "하우-스토리" };
      const r = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams({ template_object: JSON.stringify(template) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.result_code !== 0) throw new Error(`카카오 전송 실패: ${r.status} ${JSON.stringify(j)}`);
    },
  };
}
