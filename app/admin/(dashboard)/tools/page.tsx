import Link from "next/link";
import { listToolsForAdmin } from "@/lib/db/queries/admin";
import { toolStatusClass, toolStatusLabel } from "@/lib/ui/labels";

const STATUS_FILTERS = [
  { value: "", label: "الكل" },
  { value: "draft", label: "مسودة" },
  { value: "ai_processed", label: "معالج" },
  { value: "pending_review", label: "بانتظار المراجعة" },
  { value: "approved", label: "معتمد" },
  { value: "published", label: "منشور" },
  { value: "rejected", label: "مرفوض" },
  { value: "archived", label: "مؤرشف" },
];

export default async function AdminToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const result = await listToolsForAdmin({
    status: params.status,
    q: params.q,
    page: Number.isFinite(page) ? page : 1,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (result.status) query.set("status", result.status);
    if (result.q) query.set("q", result.q);
    query.set("page", String(target));
    return `/admin/tools?${query.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">الأدوات ({result.total})</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>بحث</span>
          <input
            name="q"
            defaultValue={result.q ?? ""}
            placeholder="الاسم أو المعرّف"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>الحالة</span>
          <select
            name="status"
            defaultValue={result.status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          تصفية
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">الجودة</th>
              <th className="p-3 text-start">التسعير</th>
              <th className="p-3 text-start">آخر تحديث</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.items.map((tool) => (
              <tr key={tool.id}>
                <td className="p-3">
                  <Link
                    href={`/admin/tools/${tool.id}`}
                    className="font-medium hover:underline"
                  >
                    {tool.name}
                  </Link>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(tool.status)}`}
                  >
                    {toolStatusLabel(tool.status)}
                  </span>
                </td>
                <td className="p-3">{Number(tool.qualityScore).toFixed(0)}</td>
                <td className="p-3">{tool.pricingType}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(tool.updatedAt).toLocaleString("ar")}
                </td>
              </tr>
            ))}
            {result.items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد نتائج.
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
              href={pageHref(result.page - 1)}
              className="rounded-md border border-border px-3 py-1"
            >
              السابق
            </Link>
          ) : null}
          {result.page < totalPages ? (
            <Link
              href={pageHref(result.page + 1)}
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
