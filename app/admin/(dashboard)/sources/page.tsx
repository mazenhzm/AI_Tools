import { runIngestionAction } from "@/lib/actions/ingestion";
import { toggleSourceActiveAction } from "@/lib/actions/tools";
import { listSourcesForAdmin } from "@/lib/db/queries/admin";

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const sources = await listSourcesForAdmin();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">المصادر ({sources.length})</h1>
        <form action={runIngestionAction}>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تشغيل الاستيراد الآن
          </button>
        </form>
      </div>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3 text-start">المحوّل</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">آخر جلب</th>
              <th className="p-3 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map((source) => (
              <tr key={source.id}>
                <td className="p-3 font-medium">{source.name}</td>
                <td className="p-3">{source.adapterKey}</td>
                <td className="p-3">
                  {source.active ? "نشط" : "موقوف"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {source.lastFetchedAt
                    ? new Date(source.lastFetchedAt).toLocaleString("ar")
                    : "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleSourceActiveAction}>
                      <input type="hidden" name="sourceId" value={source.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1"
                      >
                        {source.active ? "إيقاف" : "تشغيل"}
                      </button>
                    </form>
                    <form action={runIngestionAction}>
                      <input type="hidden" name="sourceId" value={source.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1"
                      >
                        جلب
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد مصادر.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
