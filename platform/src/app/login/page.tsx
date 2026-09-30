import { signIn, signUp } from "./actions";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const mode = sp.mode === "signup" ? "signup" : "login";
  const message = typeof sp.message === "string" ? sp.message : "";
  const next = typeof sp.next === "string" ? sp.next : "";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight">하우-스토리</div>
          <div className="text-sm text-stone-500">How-Story 호스트 운영 도구</div>
        </div>

        <div className="card">
          <div className="mb-4 grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm">
            <a href="/login" className={`rounded-md py-1.5 text-center ${mode === "login" ? "bg-white font-semibold shadow-sm" : "text-stone-500"}`}>로그인</a>
            <a href="/login?mode=signup" className={`rounded-md py-1.5 text-center ${mode === "signup" ? "bg-white font-semibold shadow-sm" : "text-stone-500"}`}>회원가입</a>
          </div>

          {message && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

          {mode === "login" ? (
            <form action={signIn} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <div><label className="label" htmlFor="email">이메일</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
              <div><label className="label" htmlFor="password">비밀번호</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
              <button className="btn-primary w-full" type="submit">로그인</button>
            </form>
          ) : (
            <form action={signUp} className="space-y-3">
              <div><label className="label" htmlFor="display_name">이름 (호스트 표시 이름)</label><input id="display_name" name="display_name" className="input" placeholder="예: JJ" /></div>
              <div><label className="label" htmlFor="email">이메일</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
              <div><label className="label" htmlFor="password">비밀번호 (8자 이상)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" /></div>
              <button className="btn-primary w-full" type="submit">가입하기</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
