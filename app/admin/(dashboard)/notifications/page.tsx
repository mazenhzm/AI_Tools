import Link from "next/link";
import { listNotificationEventsForAdmin } from "@/lib/db/queries/admin";
import {
  notificationStatusLabel,
  subChannelLabel,
} from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const result = await listNotificationEventsForAdmin({
    page: Number.isFinite(page) ? page : 1,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">أحداث الإشعارات ({result.total})</h1>
        <Link href="/admin" className="text-sm text-muted-foreground underline">
          ← لوحة التحكم
        </Link>
      </div>

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        يُنشأ حدث واحد لكل تحديث نموذج منشور (حقل فريد)، فلا يتكرر الإشعار
        عند إعادة نشر التحديث نفسه. «تم التخطي» يعني أن بيئة الإرسال لم
        تكن مفعّلة (مثلاً لا SMTP أو لا بوت تيليغرام) — لا ندوّن إيصالاً بلا
        إرسال حقيقي.
      </p>

      {result.events.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          لا توجد أحداث بعد. تُنشأ عند نشر تحديث نموذج.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {result.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">
                {event.modelName ?? "نموذج محذوف"}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  event.status === "delivered"
                    ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                    : event.status === "failed"
                      ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
                      : "border-border"
                }`}
              >
                {notificationStatusLabel(event.status)}
              </span>
              <span className="text-xs text-muted-foreground">
                سجلات: {event.logCount} (ناجح {event.deliveredCount}، فاشل{" "}
                {event.failedCount})
              </span>
              <span className="ms-auto text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString("ar")}
              </span>
              {event.error ? (
                <span className="w-full text-xs text-rose-600 dark:text-rose-400">
                  {event.error}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">آخر سجلات الإرسال ({result.logs.length})</h2>
        {result.logs.length === 0 ? (
          <p className="text-muted-foreground">لا توجد سجلات إرسال بعد.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {result.logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {subChannelLabel(log.channel)}
                </span>
                <span dir="ltr" className="text-xs">
                  {log.receiver ?? "مستقبِل محذوف"}
                </span>
                <span
                  className={`text-xs ${
                    log.status === "delivered"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : log.status === "failed"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {notificationStatusLabel(log.status)}
                </span>
                {log.error ? (
                  <span className="text-xs text-muted-foreground">{log.error}</span>
                ) : null}
                <span className="ms-auto text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("ar")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}