import Link from "next/link";
import { dismissFieldConflictAction, resolveFieldConflictAction } from "@/lib/actions/governance";
import { setModelUpdateStatusAction } from "@/lib/actions/models";
import { getGovernanceQueue } from "@/lib/db/queries/admin";
import { fieldLabelAr } from "@/ingestion/models/governance";
import {
  contentStatusLabel,
  modelUpdateKindLabel,
  toolStatusClass,
} from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const UPDATE_ACTION_LABELS: Record<string, string> = {
  approved: "اعتماد",
  published: "نشر",
  rejected: "رفض",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.join("، ");
  return JSON.stringify(value);
}

export default async function AdminGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const queue = await getGovernanceQueue();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          الحوكمة ({queue.openConflicts.length} نزاع + {queue.pendingModelUpdates.length} انتظار)
        </h1>
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
        <h2 className="font-semibold">
          نزاعات الحقول بين المصادر ({queue.openConflicts.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          تظهر هنا كل اختلاف في حقيقة نموذج بين مصدرين. لا تُحل تلقائياً أبداً —
          تختار أنت القيمة المعتمدة أو تتجاهل النزاع. كل قرار يُسجَّل في سجل
          المراجعات.
        </p>

        {queue.openConflicts.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-muted-foreground">
            لا توجد نزاعات مفتوحة.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.openConflicts.map((conflict) => (
              <li
                key={conflict.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/models/${conflict.entityId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {conflict.entityName ?? conflict.entityId}
                  </Link>
                  <span className="rounded-full bg-accent px-2 py-0.5">
                    {fieldLabelAr(conflict.field)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    اكتُشف:{" "}
                    {new Date(conflict.detectedAt).toLocaleString("ar")}
                  </span>
                </div>

                <dl className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">القيمة المخزنة</dt>
                    <dd className="mt-1">{formatValue(conflict.storedValue)}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">
                      المصدر أ: {conflict.sourceAName ?? conflict.sourceAId}
                      {(conflict.sourceATier ?? 0) > 0 ? ` (سلطة ${conflict.sourceATier})` : ""}
                    </dt>
                    <dd className="mt-1">{formatValue(conflict.valueA)}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">
                      المصدر ب: {conflict.sourceBName ?? conflict.sourceBId}
                      {(conflict.sourceBTier ?? 0) > 0 ? ` (سلطة ${conflict.sourceBTier})` : ""}
                    </dt>
                    <dd className="mt-1">{formatValue(conflict.valueB)}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={resolveFieldConflictAction}>
                    <input type="hidden" name="conflictId" value={conflict.id} />
                    <input type="hidden" name="resolution" value="a" />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent"
                    >
                      اعتماد قيمة المصدر أ
                    </button>
                  </form>
                  <form action={resolveFieldConflictAction}>
                    <input type="hidden" name="conflictId" value={conflict.id} />
                    <input type="hidden" name="resolution" value="b" />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent"
                    >
                      اعتماد قيمة المصدر ب
                    </button>
                  </form>
                  <form action={resolveFieldConflictAction}>
                    <input type="hidden" name="conflictId" value={conflict.id} />
                    <input type="hidden" name="resolution" value="stored" />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent"
                    >
                      الإبقاء على المخزّن
                    </button>
                  </form>
                  <form action={dismissFieldConflictAction}>
                    <input type="hidden" name="conflictId" value={conflict.id} />
                    <input
                      type="hidden"
                      name="reason"
                      value="dismissed by editor from governance queue"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1 text-muted-foreground transition-colors hover:bg-accent"
                    >
                      تجاهل
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">
          تغييرات النماذج بانتظار القرار ({queue.pendingModelUpdates.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          الحقول الحساسة (التسعير، التحميل المفتوح) لا تُطبَّق تلقائياً على
          صف النموذج — اعتمادها أو نشرها هنا هو ما يطبّقها على الصف ويسجّلها
          كمراجعة.
        </p>

        {queue.pendingModelUpdates.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-muted-foreground">
            لا توجد تغييرات بانتظار القرار.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingModelUpdates.map((update) => (
              <li
                key={update.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {modelUpdateKindLabel(update.kind)}
                  </span>
                  <Link
                    href={`/admin/models/${update.modelId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {update.modelName}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(update.status)}`}
                  >
                    {contentStatusLabel(update.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(update.createdAt).toLocaleString("ar")}
                  </span>
                </div>
                <h3 className="font-medium">{update.title}</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {update.contentAr || "—"}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    بانتظار المراجعة:{" "}
                    {(update.pendingReview.length > 0
                      ? update.pendingReview.map(fieldLabelAr)
                      : ["—"]
                    ).join("، ")}
                  </span>
                  {update.autoApplied.length > 0 ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      طُبِّق تلقائياً: {update.autoApplied.map(fieldLabelAr).join("، ")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["approved", "published", "rejected"] as const)
                    .filter((state) => state !== update.status)
                    .map((state) => (
                      <form key={state} action={setModelUpdateStatusAction}>
                        <input type="hidden" name="modelId" value={update.modelId} />
                        <input type="hidden" name="updateId" value={update.id} />
                        <input type="hidden" name="to" value={state} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-3 py-1 transition-colors hover:bg-accent"
                        >
                          {UPDATE_ACTION_LABELS[state] ?? state}
                        </button>
                      </form>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}