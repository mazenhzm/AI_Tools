import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { auth } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "لوحة التحكم" },
  { href: "/admin/tools", label: "الأدوات" },
  { href: "/admin/categories", label: "التصنيفات" },
  { href: "/admin/tags", label: "الوسوم" },
  { href: "/admin/collections", label: "القوائم" },
  { href: "/admin/sources", label: "المصادر" },
  { href: "/admin/runs", label: "التشغيلات" },
  { href: "/admin/monetization", label: "التمويل" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 p-4">
          <Link href="/admin" className="font-bold">
            لوحة التحكم
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
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {session.user.email} ({session.user.role})
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent"
              >
                خروج
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </div>
  );
}
