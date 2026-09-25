import Link from "next/link";
import { listSubscriptionsForAdmin } from "@/lib/db/queries/admin";
import {
  subChannelLabel,
  subStatusLabel,
  subTargetTypeLabel,
  toolStatusClass,
} from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string;
    status?: string;
    page?: string;
    message?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const { message } = params;

  const result = await listSubscriptionsForAdmin({
    channel: params.channel,
    status: params.status,
    page: Number.isFinite(page) ? page : 1,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">اشتراكات إشعارات التغيير ({result.total})</h1>
        <Link href="/admin" className="text-sm text-muted-foreground underline">
          ← لوحة التحكم
        </Link>
      </div>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <form method="get" className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>القناة</span>
          <select
            name="channel"
            defaultValue={params.channel ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">الكل</option>
            <option value="email">بريد</option>
            <option value="telegram">تيليغرام</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>الحالة</span>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">الكل</option>
            <option value="pending">بانتظار التحقق</option>
            <option value="active">نشط</option>
            <option value="unsubscribed">ملغى</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تطبيق
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          لا توجد اشتراكات بعد.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {result.items.map((subscription) => (
            <li key={subscription.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium" dir="ltr">
                {subscription.receiver}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {subChannelLabel(subscription.channel)}
              </span>
              <span className="text-xs text-muted-foreground">
                {subTargetTypeLabel(subscription.targetType)}:{" "}
                {subscription.targetName ?? subscription.targetId}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(subscription.status)}`}
              >
                {subStatusLabel(subscription.status)}
              </span>
              {subscription.verifiedAt ? (
                <span className="text-xs text-muted-foreground">
                  تحقّق: {new Date(subscription.verifiedAt).toLocaleString("ar")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}