import Link from "next/link";
import { listModelsForAdmin } from "@/lib/db/queries/admin";
import { contentStatusLabel, toolStatusClass } from "@/lib/ui/labels";

export default async function AdminModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; message?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const { message } = params;

  const result = await listModelsForAdmin({
    status: params.status,
    q: params.q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">النماذج ({result.total})</h1>
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
          <span>الحالة</span>
          <select
            name="status"
            defaultValue={result.status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">الكل</option>
            {["draft", "pending_review", "approved", "published", "rejected"].map(
              (status) => (
                <option key={status} value={status}>
                  {contentStatusLabel(status)}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>بحث</span>
          <input
            name="q"
            defaultValue={result.q ?? ""}
            placeholder="اسم النموذج أو المعرّف (slug)"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-3">
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
          لا توجد نماذج مطابقة. شغّل `npm run worker:models` بعد إضافة مصدر
          نموذج (adapterKey يبدأ بـ `model:`).
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {result.items.map((model) => (
            <li key={model.id} className="flex flex-wrap items-center gap-3 p-3">
              <Link
                href={`/admin/models/${model.id}`}
                className="font-medium hover:underline"
              >
                {model.name}
              </Link>
              {model.providerName ? (
                <span className="text-xs text-muted-foreground">
                  {model.providerName}
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${toolStatusClass(model.status)}`}
              >
                {contentStatusLabel(model.status)}
              </span>
              {model.isDownloadable ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  مفتوح
                </span>
              ) : null}
              <span className="ms-auto text-xs text-muted-foreground">
                تحديثات: {model.updatedCount} —{" "}
                {new Date(model.updatedAt).toLocaleString("ar")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.total > result.pageSize ? (
        <nav className="flex items-center gap-3 text-sm">
          <span>
            صفحة {result.page} من {Math.ceil(result.total / result.pageSize)}
          </span>
          {result.page > 1 ? (
            <Link
              href={`/admin/models?page=${result.page - 1}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-muted"
            >
              السابق
            </Link>
          ) : null}
          {result.page * result.pageSize < result.total ? (
            <Link
              href={`/admin/models?page=${result.page + 1}`}
              className="rounded-md border border-border px-3 py-1 hover:bg-muted"
            >
              التالي
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}