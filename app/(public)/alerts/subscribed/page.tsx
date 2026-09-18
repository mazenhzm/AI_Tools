import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { env } from "@/lib/env";

export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; targetId?: string; token?: string }>;
}) {
  const params = await searchParams;
  const hasToken =
    (params.targetType === "model" || params.targetType === "provider") &&
    Boolean(params.targetId && params.token);

  if (!hasToken) notFound();

  let targetLabel = "";
  if (params.targetType === "model" && params.targetId) {
    const [model] = await db
      .select({ name: s.models.name })
      .from(s.models)
      .where(eq(s.models.id, params.targetId))
      .limit(1);
    targetLabel = model?.name ?? "";
  } else if (params.targetType === "provider" && params.targetId) {
    const [provider] = await db
      .select({ name: s.modelProviders.name })
      .from(s.modelProviders)
      .where(eq(s.modelProviders.id, params.targetId))
      .limit(1);
    targetLabel = provider?.name ?? "";
  }

  const devOnly = !env.smtpHost;
  const token = encodeURIComponent(params.token ?? "");
  const verifyHref = `/alerts/verify?token=${token}`;
  const unsubscribeHref = `/alerts/unsubscribe?token=${token}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-border p-6">
      <h1 className="text-xl font-bold">طلب إشعارات التغيير</h1>
      <p className="text-sm text-muted-foreground">
        {devOnly
          ? "تم تسجيل طلب الاشتراك. بما أن إرسال البريد غير مفعّل في هذه البيئة، استخدم رابط التحقق أدناه لإكمال الاشتراك."
          : "تم تسجيل طلب الاشتراك. أُرسل إليك بريد تحقق؛ افتح رابطه لإكمال الاشتراك."}
      </p>
      {targetLabel ? <p className="text-sm">الهدف: {targetLabel}</p> : null}
      {devOnly ? (
        <p className="rounded-md border border-dashed border-border bg-muted p-3 text-xs text-muted-foreground">
          بيئة تطوير: بدون SMTP يستحيل إيصال البريد، لذا نعرض رابط التحقق هنا
          فقط. بعد إعداد SMTP يُرسل الرابط تلقائياً إلى البريد.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={verifyHref}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          تحقّق من الاشتراك
        </Link>
        <Link
          href={unsubscribeHref}
          className="rounded-md border border-border px-4 py-2 hover:bg-muted"
        >
          إلغاء الاشتراك
        </Link>
      </div>
    </div>
  );
}