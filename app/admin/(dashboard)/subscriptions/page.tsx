import Link from "next/link";
import { createAdminSubscriptionAction } from "@/lib/actions/models";
import {
  listSubscriptionsForAdmin,
} from "@/lib/db/queries/admin";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
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

  const [result, models, providers] = await Promise.all([
    listSubscriptionsForAdmin({
      channel: params.channel,
      status: params.status,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 20,
    }),
    db
      .select({ id: s.models.id, name: s.models.name })
      .from(s.models)
      .orderBy(s.models.name),
    db
      .select({ id: s.modelProviders.id, name: s.modelProviders.name })
      .from(s.modelProviders)
      .orderBy(s.modelProviders.name),
  ]);

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

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">إضافة اشتراك (تيليغرام أو بريد)</h2>
        <form action={createAdminSubscriptionAction} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span>القناة</span>
            <select
              name="channel"
              defaultValue="telegram"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="telegram">تيليغرام</option>
              <option value="email">بريد إلكتروني</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>المستقبِل (بريد إلكتروني أو معرّف محادثة تيليغرام)</span>
            <input
              name="receiver"
              required
              placeholder="user@example.com أو 123456789"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>نوع الهدف</span>
            <select
              name="targetType"
              defaultValue="model"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="model">نموذج</option>
              <option value="provider">موفّر / شركة</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>النموذج (عند اختيار «نموذج»)</span>
            <select
              name="targetIdModel"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>الموفّر (عند اختيار «موفّر»)</span>
            <select
              name="targetIdProvider"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground md:col-span-2"
          >
            إنشاء الاشتراك
          </button>
        </form>
      </section>

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