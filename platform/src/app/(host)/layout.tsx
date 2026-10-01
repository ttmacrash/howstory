import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function HostLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/dashboard" className="text-base font-bold tracking-tight">하우-스토리</Link>
            <Link href="/dashboard" className="text-stone-600 hover:text-stone-900">대시보드</Link>
            <Link href="/listings" className="text-stone-600 hover:text-stone-900">숙소</Link>
          </nav>
          <form action={signOut} className="flex items-center gap-3 text-sm">
            <span className="text-stone-500">{profile?.display_name ?? user.email}</span>
            <button className="btn-secondary !py-1" type="submit">로그아웃</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
