import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하우-스토리 호스트",
  description: "How-Story 호스트 운영 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
