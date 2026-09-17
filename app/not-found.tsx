import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
  description: "الصفحة المطلوبة غير متوفرة.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold">404</p>
      <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
      <p className="text-sm text-muted-foreground">
        قد يكون الرابط غير صحيح أو أن الصفحة حُذفت.
      </p>
      <nav className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          الصفحة الرئيسية
        </Link>
        <Link href="/tools" className="rounded-md border border-border px-4 py-2">
          استعراض الأدوات
        </Link>
        <Link href="/search" className="rounded-md border border-border px-4 py-2">
          البحث
        </Link>
      </nav>
    </div>
  );
}
