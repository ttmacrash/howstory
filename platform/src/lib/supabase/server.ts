import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 서버 컴포넌트·서버 액션·라우트 핸들러용. 로그인한 사용자의 세션으로 동작하므로 RLS가 적용된다. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // 서버 컴포넌트에서 호출되면 쿠키를 쓸 수 없다. proxy.ts가 세션을 갱신하므로 무시해도 된다.
          }
        },
      },
    },
  );
}

/** 로그인 사용자를 돌려주고, 없으면 null. 페이지에서 리다이렉트 판단에 쓴다. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
