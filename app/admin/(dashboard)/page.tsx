import Link from "next/link";
import {
  adminDashboardStats,
  listIngestionRuns,
  listToolsForAdmin,
} from "@/lib/db/queries/admin";
import {
  runStatusLabel,
  toolStatusClass,
  toolStatusLabel,
} from "@/lib/ui/labels";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [stats, reviewQueue, runs] = await Promise.all([
    adminDashboardStats(),
    listToolsForAdmin({ status: "pending_review", pageSize: 8 }),
    listIngestionRuns({ pageSize: 5 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">نظرة عامة</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="إجمالي الأدوات" value={stats.totalTools} />
        <StatCard
          label="منشورة"
          value={stats.byStatus.published ?? 0}
          hint={`معتمدة: ${stats.byStatus.approved ?? 0}`}
        />
        <StatCard
          label="بانتظار المراجعة"
          value={stats.byStatus.pending_review ?? 0}
        />
        <StatCard
          label="المصادر النشطة"
          value={`${stats.activeSources}/${stats.totalSources}`}
        />
        <StatCard label="إجمالي التشغيلات" value={stats.totalRuns} />
        <StatCard label="تشغيلات فاشلة" value={stats.failedRuns} />
        <StatCard
          label="آخر تشغيل"
          value={
            stats.lastRunAt
              ? new Date(stats.lastRunAt).toLocaleString("ar")
              : "لا يوجد"
          }
        />
        <StatCard label="مسودات" value={stats.byStatus.draft ?? 0} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">بانتظار المراجعة</h2>
          <Link
            href="/admin/tools?status=pending_review"
            className="text-sm text-muted-foreground underline"
          >
            عرض الكل
          </Link>
        </div>
        {reviewQueue.items.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            لا توجد أدوات بانتظار المراجعة.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {reviewQueue.items.map((tool) => (
              <li
                key={tool.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <Link
                  href={`/admin/tools/${tool.id}`}
                  className="font-medium hover:underline"
                >
                  {tool.name}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(tool.status)}`}
                >
                  {toolStatusLabel(tool.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  الجودة: {Number(tool.qualityScore).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">آخر التشغيلات</h2>
          <Link
            href="/admin/runs"
            className="text-sm text-muted-foreground underline"
          >
            عرض الكل
          </Link>
        </div>
        {runs.items.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            لم يتم تشغيل الاستيراد بعد.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {runs.items.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="font-medium">
                  {run.sourceName ?? "مصدر محذوف"}
                </span>
                <span className="text-muted-foreground">
                  {runStatusLabel(run.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString("ar")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
