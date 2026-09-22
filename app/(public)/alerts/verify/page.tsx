import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAlertSubscription } from "@/lib/notifications/service";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "تحقق من اشتراك التنبيهات",
  path: "/alerts/verify",
  noIndex: true,
});

export default async function VerifyAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) notFound();

  const result = await verifyAlertSubscription(token);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-4 rounded-2xl border border-border p-6">
      <h1 className="text-xl font-bold">التحقق من الاشتراك</h1>
      {result.ok ? (
        <>
          <p className="text-sm text-muted-foreground">
            تم تفعيل اشتراكك في إشعارات التغيير بنجاح.
          </p>
          <Link
            href="/models"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            تصفح النماذج
          </Link>
        </>
      ) : (
        <p className="text-sm text-rose-600">
          {result.error ?? "تعذر التحقق من هذا الرابط."}
        </p>
      )}
    </div>
  );
}