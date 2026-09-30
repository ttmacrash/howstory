"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function backTo(mode: "login" | "signup", message: string, next?: string): never {
  const q = new URLSearchParams({ mode, message });
  if (next) q.set("next", next);
  redirect(`/login?${q.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/dashboard";
  if (!email || !password) backTo("login", "이메일과 비밀번호를 입력해 주세요.", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) backTo("login", "이메일 또는 비밀번호가 맞지 않습니다.", next);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!email || password.length < 8) backTo("signup", "이메일을 입력하고 비밀번호는 8자 이상으로 해 주세요.");

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) backTo("signup", `가입에 실패했습니다: ${error.message}`);
  // 이메일 확인이 꺼져 있으면 세션이 바로 생긴다.
  if (data.session) redirect("/dashboard");
  backTo("login", "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
