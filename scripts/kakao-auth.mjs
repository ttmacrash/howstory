// 카카오 "나에게 보내기"용 refresh token을 한 번만 발급받는 도우미. (로컬에서 실행)
//   1) node scripts/kakao-auth.mjs <REST_API_KEY> <REDIRECT_URI>            → 브라우저에서 열 주소를 출력
//   2) 브라우저에서 동의 후 주소창의 code=XXXX 값을 복사
//   3) node scripts/kakao-auth.mjs <REST_API_KEY> <REDIRECT_URI> <CODE> [CLIENT_SECRET] → refresh token 출력
const [key, redirect, code, secret] = process.argv.slice(2);
if (!key || !redirect) { console.log('사용법: node scripts/kakao-auth.mjs <REST_API_KEY> <REDIRECT_URI> [CODE] [CLIENT_SECRET]'); process.exit(1); }
if (!code) {
  console.log('아래 주소를 브라우저에서 열고 동의하세요. 이동한 주소창의 ?code= 뒤 값을 복사합니다.\n');
  console.log(`https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${key}&redirect_uri=${encodeURIComponent(redirect)}&scope=talk_message`);
  process.exit(0);
}
const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: key, redirect_uri: redirect, code });
if (secret) body.set('client_secret', secret);
const r = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body });
const j = await r.json();
if (!j.refresh_token) { console.error('실패:', j); process.exit(1); }
console.log('\nKAKAO_REFRESH_TOKEN =', j.refresh_token, '\n\n이 값을 GitHub 저장소 Secrets에 KAKAO_REFRESH_TOKEN 이름으로 넣으세요. (60일 유효, 감시 작업이 자동으로 갱신해 Supabase에 보관합니다)');
