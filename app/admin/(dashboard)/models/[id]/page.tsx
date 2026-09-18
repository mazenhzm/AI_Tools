import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setModelStatusAction,
  setModelUpdateStatusAction,
  updateModelFieldsAction,
} from "@/lib/actions/models";
import { getModelForAdmin } from "@/lib/db/queries/admin";
import { MODEL_STATUS_TRANSITIONS } from "@/lib/services/model-review";
import {
  contentStatusLabel,
  modelUpdateKindLabel,
  subChannelLabel,
  subStatusLabel,
  subTargetTypeLabel,
  toolStatusClass,
} from "@/lib/ui/labels";

const ACTION_LABELS: Record<string, string> = {
  pending_review: "إرسال للمراجعة",
  approved: "اعتماد",
  published: "نشر",
  rejected: "رفض",
  draft: "إلى مسودة",
};

const UPDATE_ACTION_LABELS: Record<string, string> = {
  published: "نشر التحديث (مع الإشعارات)",
  rejected: "رفض التحديث",
  pending_review: "إرسال للمراجعة",
};

export default async function AdminModelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  const data = await getModelForAdmin(id);
  if (!data) notFound();

  const { model, provider, sources, updates, revisions, subscriptions } = data;
  const nextStates = MODEL_STATUS_TRANSITIONS[model.status] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/models" className="text-sm underline">
          ← النماذج
        </Link>
        <h1 className="text-xl font-bold">{model.name}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(model.status)}`}
        >
          {contentStatusLabel(model.status)}
        </span>
        {model.publishedAt ? (
          <a
            href={`/models/${model.slug}`}
            target="_blank"
            className="text-sm text-primary underline"
          >
            عرض الصفحة العامة
          </a>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
          <h2 className="font-semibold">البيانات الأساسية</h2>
          <dl className="flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">المعرّف (slug)</dt>
              <dd>{model.slug}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">الموفّر</dt>
              <dd>{provider?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">معرّف النموذج</dt>
              <dd>{model.modelIdentifier || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">الإصدار الحالي</dt>
              <dd>{model.currentVersion || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">تاريخ الإصدار</dt>
              <dd>{model.releaseDate || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">نافذة السياق</dt>
              <dd>{model.contextWindow?.toLocaleString("en-US") ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">سعر الإدخال/1M</dt>
              <dd>{model.inputPricePer1M ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">سعر الإخراج/1M</dt>
              <dd>{model.outputPricePer1M ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">المصدر المفتوح</dt>
              <dd>{model.isDownloadable ? "نعم" : "لا"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">أنماط الوسائط</dt>
              <dd>{model.modalities.length > 0 ? model.modalities.join("، ") : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">التحديث</dt>
              <dd>{new Date(model.updatedAt).toLocaleString("ar")}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 text-sm">
          <h2 className="font-semibold">إجراءات المراجعة</h2>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((state) => (
              <form key={state} action={setModelStatusAction}>
                <input type="hidden" name="modelId" value={model.id} />
                <input type="hidden" name="to" value={state} />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1"
                >
                  {ACTION_LABELS[state] ?? state}
                </button>
              </form>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            ملاحظة: «الأكثر استخداماً» غير متاح لأن نظامنا لا يمتلك إحصائية
            استخدام حقيقية.
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">تعديل البيانات</h2>
        <form action={updateModelFieldsAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="modelId" value={model.id} />
          <label className="flex flex-col gap-1">
            <span>الاسم</span>
            <input
              name="name"
              defaultValue={model.name}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>معرّف النموذج</span>
            <input
              name="modelIdentifier"
              defaultValue={model.modelIdentifier}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>الإصدار الحالي</span>
            <input
              name="currentVersion"
              defaultValue={model.currentVersion ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>تاريخ الإصدار (YYYY-MM-DD)</span>
            <input
              name="releaseDate"
              defaultValue={model.releaseDate ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>نافذة السياق (رموز)</span>
            <input
              type="number"
              min="0"
              name="contextWindow"
              defaultValue={model.contextWindow ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>سعر الإدخال لكل مليون رمز ($)</span>
            <input
              type="number"
              step="any"
              min="0"
              name="inputPricePer1M"
              defaultValue={model.inputPricePer1M ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>سعر الإخراج لكل مليون رمز ($)</span>
            <input
              type="number"
              step="any"
              min="0"
              name="outputPricePer1M"
              defaultValue={model.outputPricePer1M ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>ملاحظات التسعير</span>
            <input
              name="pricingNotes"
              defaultValue={model.pricingNotes ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>الموقع الرسمي</span>
            <input
              name="websiteUrl"
              defaultValue={model.websiteUrl ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>الوصف العربي</span>
            <textarea
              name="descriptionAr"
              defaultValue={model.descriptionAr}
              rows={3}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>الوصف الإنجليزي</span>
            <textarea
              name="descriptionEn"
              defaultValue={model.descriptionEn}
              rows={2}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>أنماط الوسائط (مفصولة بفاصلة)</span>
            <input
              name="modalities"
              defaultValue={model.modalities.join(", ")}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              name="isDownloadable"
              value="1"
              defaultChecked={model.isDownloadable}
            />
            <span>مفتوح المصدر / قابل للتحميل</span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              حفظ البيانات
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">التغييرات المكتشفة ({updates.length})</h2>
        <ul className="flex flex-col gap-3">
          {updates.map((update) => (
            <li
              key={update.id}
              className="flex flex-col gap-2 border-b border-border pb-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {modelUpdateKindLabel(update.kind)}
                </span>
                <span className="font-medium">{update.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(update.status)}`}
                >
                  {contentStatusLabel(update.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(update.createdAt).toLocaleString("ar")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {update.contentAr || "—"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["published", "rejected", "pending_review"] as const)
                  .filter((state) => state !== update.status)
                  .map((state) => (
                    <form key={state} action={setModelUpdateStatusAction}>
                      <input type="hidden" name="modelId" value={model.id} />
                      <input type="hidden" name="updateId" value={update.id} />
                      <input type="hidden" name="to" value={state} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1"
                      >
                        {UPDATE_ACTION_LABELS[state] ?? state}
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
          {updates.length === 0 ? (
            <li className="text-muted-foreground">
              لا توجد تغييرات مكتشفة بعد. تُنشأ تلقائياً عند تغيّر حقائق النموذج
              في تشغيل worker-models.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">الاشتراكات ({subscriptions.length})</h2>
        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground">لا توجد اشتراكات لهذا الهدف.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {subscriptions.map((subscription) => (
              <li
                key={subscription.id}
                className="flex flex-wrap items-center gap-3"
              >
                <span>{subscription.receiver}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {subChannelLabel(subscription.channel)}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {subTargetTypeLabel(subscription.targetType)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(subscription.status)}`}
                >
                  {subStatusLabel(subscription.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(subscription.createdAt).toLocaleString("ar")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">المصادر ({sources.length})</h2>
        <ul className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={source.id} className="flex flex-wrap gap-3">
              <span>{source.sourceItemId}</span>
              <span className="text-muted-foreground">
                آخر ظهور: {new Date(source.lastSeenAt).toLocaleString("ar")}
              </span>
            </li>
          ))}
          {sources.length === 0 ? (
            <li className="text-muted-foreground">لا توجد مصادر مرتبطة.</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">المراجعات ({revisions.length})</h2>
        <ul className="flex flex-col gap-1">
          {revisions.map((revision) => (
            <li key={revision.id} className="flex flex-wrap gap-3">
              <span>{revision.field}</span>
              <span className="text-muted-foreground">{revision.reason}</span>
              <span className="text-muted-foreground">
                {new Date(revision.createdAt).toLocaleString("ar")}
              </span>
            </li>
          ))}
          {revisions.length === 0 ? (
            <li className="text-muted-foreground">لا توجد مراجعات.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}