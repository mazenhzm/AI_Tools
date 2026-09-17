import Link from "next/link";
import { runIngestionAction } from "@/lib/actions/ingestion";
import { listIngestionRuns } from "@/lib/db/queries/admin";
import {
  formatDurationMs,
  metricNumber,
  runStatusLabel,
} from "@/lib/ui/labels";

export default async function AdminRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const result = await listIngestionRuns({
    page: Number.isFinite(page) ? page : 1,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          تشغيلات الاستيراد ({result.total})
        </h1>
        <form action={runIngestionAction}>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تشغيل الاستيراد الآن
          </button>
        </form>
      </div>

      {params.message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {params.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start">المصدر</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">المقاييس</th>
              <th className="p-3 text-start">البدء</th>
              <th className="p-3 text-start">خطأ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.items.map((run) => (
              <tr key={run.id}>
                <td className="p-3 align-top">{run.sourceName ?? "—"}</td>
                <td className="p-3 align-top">{runStatusLabel(run.status)}</td>
                <td className="p-3 align-top">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <span>جلب: {metricNumber(run.metrics, "fetched")}</span>
                    <span>جديد: {metricNumber(run.metrics, "created")}</span>
                    <span>محدّث: {metricNumber(run.metrics, "updated")}</span>
                    <span>مكرر: {metricNumber(run.metrics, "duplicates")}</span>
                    <span>غير صالح: {metricNumber(run.metrics, "invalid")}</span>
                    <span>أخطاء: {metricNumber(run.metrics, "errors")}</span>
                    <span>
                      الذكاء: {metricNumber(run.metrics, "aiProcessed")}/
                      {metricNumber(run.metrics, "aiFailed")}
                    </span>
                    <span>
                      المدة: {formatDurationMs(metricNumber(run.metrics, "durationMs"))}
                    </span>
                  </div>
                  {run.metrics?.adapter ? (
                    <span className="mt-1 inline-block text-xs text-muted-foreground">
                      المحوّل: {String(run.metrics.adapter)}
                    </span>
                  ) : null}
                </td>
                <td className="p-3 align-top text-xs text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString("ar")}
                  {run.finishedAt ? (
                    <span className="block">
                      انتهى: {new Date(run.finishedAt).toLocaleTimeString("ar")}
                    </span>
                  ) : null}
                </td>
                <td className="p-3 align-top text-xs text-rose-600 dark:text-rose-400">
                  {run.error ?? ""}
                </td>
              </tr>
            ))}
            {result.items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد تشغيلات.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          صفحة {result.page} من {totalPages}
        </span>
        <div className="flex gap-2">
          {result.page > 1 ? (
            <Link
              href={`/admin/runs?page=${result.page - 1}`}
              className="rounded-md border border-border px-3 py-1"
            >
              السابق
            </Link>
          ) : null}
          {result.page < totalPages ? (
            <Link
              href={`/admin/runs?page=${result.page + 1}`}
              className="rounded-md border border-border px-3 py-1"
            >
              التالي
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
