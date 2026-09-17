import Link from "next/link";
import {
  createCollectionAction,
  deleteCollectionAction,
} from "@/lib/actions/catalog";
import { auth } from "@/lib/auth";
import { listCollectionsWithCounts } from "@/lib/db/queries/catalog";
import { contentStatusLabel } from "@/lib/ui/labels";

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const [collections, session] = await Promise.all([
    listCollectionsWithCounts(),
    auth(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">القوائم المنسّقة ({collections.length})</h1>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-3 font-semibold">إنشاء قائمة</h2>
        <form
          action={createCollectionAction}
          className="grid gap-2 md:grid-cols-2"
        >
          <input
            name="titleAr"
            required
            placeholder="العنوان بالعربية"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="titleEn"
            required
            placeholder="العنوان بالإنجليزية"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="slug"
            placeholder="المعرّف (اختياري)"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="descriptionAr"
            placeholder="وصف مختصر (اختياري)"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground md:col-span-2"
          >
            إنشاء
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start">العنوان</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">الأدوات</th>
              <th className="p-3 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {collections.map((collection) => (
              <tr key={collection.id}>
                <td className="p-3">
                  <Link
                    href={`/admin/collections/${collection.id}`}
                    className="font-medium hover:underline"
                  >
                    {collection.titleAr}
                  </Link>
                  <span className="ms-2 text-xs text-muted-foreground">
                    /{collection.slug}
                  </span>
                </td>
                <td className="p-3">{contentStatusLabel(collection.status)}</td>
                <td className="p-3">{collection.toolCount}</td>
                <td className="p-3">
                  {isAdmin ? (
                    <form action={deleteCollectionAction}>
                      <input
                        type="hidden"
                        name="collectionId"
                        value={collection.id}
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-rose-300 px-3 py-1 text-rose-600"
                      >
                        حذف
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {collections.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد قوائم.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
