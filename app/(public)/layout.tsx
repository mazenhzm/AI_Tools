import Link from "next/link";
import type { ReactNode } from "react";
import { AdSlot } from "@/components/site/ad-slot";
import { listPublicCategories } from "@/lib/db/queries/public";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/tools", label: "الأدوات" },
  { href: "/models", label: "النماذج" },
  { href: "/categories", label: "التصنيفات" },
  { href: "/collections", label: "القوائم" },
];

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const categories = await listPublicCategories();
  const navCategories = categories
    .filter((category) => category.toolCount > 0)
    .slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            أدوات الذكاء الاصطناعي
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/search" className="ms-auto flex items-center gap-2">
            <input
              name="q"
              placeholder="ابحث عن أداة…"
              aria-label="بحث"
              className="w-40 rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary sm:w-56"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              بحث
            </button>
          </form>
        </div>
        {navCategories.length > 0 ? (
          <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 pb-2 text-xs">
            {navCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {category.nameAr}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <AdSlot placement="header" className="mb-6" />
        {children}
      </main>

      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} أدوات الذكاء الاصطناعي — دليل عربي.</p>
          <nav className="flex flex-wrap gap-3 sm:ms-auto">
            <Link href="/about" className="hover:underline">
              من نحن
            </Link>
            <Link href="/contact" className="hover:underline">
              اتصل بنا
            </Link>
            <Link href="/privacy" className="hover:underline">
              الخصوصية
            </Link>
            <Link href="/terms" className="hover:underline">
              الشروط
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
