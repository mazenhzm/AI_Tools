import Link from "next/link";
import { notFound } from "next/navigation";
import {
  reprocessToolAction,
  setToolStatusAction,
  setUpdateStatusAction,
} from "@/lib/actions/tools";
import {
  setAffiliateAction,
  setFeaturedAction,
} from "@/lib/actions/monetization";
import { getToolForAdmin } from "@/lib/db/queries/admin";
import { TOOL_STATUS_TRANSITIONS } from "@/lib/services/review";
import {
  contentStatusLabel,
  pricingLabel,
  toolStatusClass,
  toolStatusLabel,
} from "@/lib/ui/labels";

const CONTENT_ACTION_LABELS: Record<string, string> = {
  published: "نشر التحديث",
  rejected: "رفض التحديث",
  pending_review: "إرسال للمراجعة",
};

const ACTION_LABELS: Record<string, string> = {
  ai_processed: "تعليم كمعالج",
  pending_review: "إرسال للمراجعة",
  approved: "اعتماد",
  published: "نشر",
  rejected: "رفض",
  archived: "أرشفة",
  draft: "إعادة إلى مسودة",
};

export default async function AdminToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  const data = await getToolForAdmin(id);
  if (!data) notFound();

  const { tool, sources, logs, revisions, updates, categoryName } = data;
  const nextStates = TOOL_STATUS_TRANSITIONS[tool.status] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/tools" className="text-sm underline">
          ← الأدوات
        </Link>
        <h1 className="text-xl font-bold">{tool.name}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(tool.status)}`}
        >
          {toolStatusLabel(tool.status)}
        </span>
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
              <dd>{tool.slug}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">التصنيف</dt>
              <dd>{categoryName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">التسعير</dt>
              <dd>
                {pricingLabel(tool.pricingType)}
                {tool.pricingNotes ? ` — ${tool.pricingNotes}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">الموقع</dt>
              <dd>
                {tool.websiteUrl ? (
                  <a
                    href={tool.websiteUrl}
                    rel="nofollow noopener"
                    target="_blank"
                    className="underline"
                  >
                    {tool.websiteUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">درجة الجودة</dt>
              <dd>{Number(tool.qualityScore).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">تاريخ النشر</dt>
              <dd>
                {tool.publishedAt
                  ? new Date(tool.publishedAt).toLocaleString("ar")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 text-sm">
          <h2 className="font-semibold">إجراءات المراجعة</h2>
          <div className="flex flex-wrap gap-2">
            {nextStates.map((state) => (
              <form key={state} action={setToolStatusAction}>
                <input type="hidden" name="toolId" value={tool.id} />
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
          <form action={reprocessToolAction}>
            <input type="hidden" name="toolId" value={tool.id} />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1"
            >
              إعادة المعالجة بالذكاء الاصطناعي
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">التمويل</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            التمييز: {tool.isFeatured ? "مميّزة" : "غير مميّزة"}
          </span>
          <form action={setFeaturedAction}>
            <input type="hidden" name="toolId" value={tool.id} />
            <input
              type="hidden"
              name="featured"
              value={tool.isFeatured ? "false" : "true"}
            />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1"
            >
              {tool.isFeatured ? "إلغاء التمييز" : "تمييز الأداة"}
            </button>
          </form>
        </div>
        <form action={setAffiliateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="toolId" value={tool.id} />
          <label className="flex flex-1 flex-col gap-1">
            <span>رابط العمولة</span>
            <input
              name="affiliateUrl"
              defaultValue={tool.affiliateUrl ?? ""}
              placeholder="https://…"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1"
          >
            حفظ الرابط
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">الوصف العربي</h2>
        <p className="whitespace-pre-wrap">
          {tool.descriptionAr || "لا يوجد وصف عربي بعد."}
        </p>
        <h2 className="mt-2 font-semibold">الوصف الإنجليزي</h2>
        <p className="whitespace-pre-wrap">
          {tool.descriptionEn || "لا يوجد وصف إنجليزي بعد."}
        </p>
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
        <h2 className="font-semibold">سجل الذكاء الاصطناعي ({logs.length})</h2>
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col gap-1 border-b border-border pb-2">
              <span>
                {log.failed ? "فشل" : "نجاح"} — {log.model ?? "—"} (
                {log.promptVersion ?? "—"})
              </span>
              <span className="text-muted-foreground">
                {new Date(log.createdAt).toLocaleString("ar")}
                {log.confidence ? ` — الثقة: ${log.confidence}` : ""}
              </span>
              {log.error ? (
                <span className="text-rose-600 dark:text-rose-400">
                  {log.error}
                </span>
              ) : null}
              {log.warnings.length > 0 ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {log.warnings.join(" | ")}
                </span>
              ) : null}
            </li>
          ))}
          {logs.length === 0 ? (
            <li className="text-muted-foreground">لا يوجد سجل بعد.</li>
          ) : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">التحديثات المكتشفة ({updates.length})</h2>
        <ul className="flex flex-col gap-3">
          {updates.map((update) => (
            <li
              key={update.id}
              className="flex flex-col gap-2 border-b border-border pb-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{update.title}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {contentStatusLabel(update.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(update.createdAt).toLocaleString("ar")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {update.contentAr || "—"}
              </p>
              {update.sourceUrl ? (
                <a
                  href={update.sourceUrl}
                  target="_blank"
                  rel="nofollow noopener"
                  className="text-xs underline"
                >
                  {update.sourceUrl}
                </a>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(["published", "rejected", "pending_review"] as const)
                  .filter((state) => state !== update.status)
                  .map((state) => (
                    <form key={state} action={setUpdateStatusAction}>
                      <input type="hidden" name="toolId" value={tool.id} />
                      <input type="hidden" name="updateId" value={update.id} />
                      <input type="hidden" name="to" value={state} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1"
                      >
                        {CONTENT_ACTION_LABELS[state] ?? state}
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
          {updates.length === 0 ? (
            <li className="text-muted-foreground">لا توجد تحديثات مكتشفة.</li>
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
