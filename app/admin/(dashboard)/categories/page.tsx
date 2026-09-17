import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/catalog";
import { auth } from "@/lib/auth";
import { listCategoriesWithCounts } from "@/lib/db/queries/catalog";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const [categories, session] = await Promise.all([
    listCategoriesWithCounts(),
    auth(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">التصنيفات ({categories.length})</h1>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-3 font-semibold">إضافة تصنيف</h2>
        <form
          action={createCategoryAction}
          className="grid gap-2 md:grid-cols-2"
        >
          <input
            name="nameAr"
            required
            placeholder="الاسم بالعربية"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="nameEn"
            required
            placeholder="الاسم بالإنجليزية"
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
            إضافة
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        {categories.map((category) => (
          <details
            key={category.id}
            className="rounded-xl border border-border p-4"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-medium">{category.nameAr}</span>
              <span className="text-sm text-muted-foreground">
                {category.nameEn}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {category.toolCount} أداة
              </span>
              <span className="text-xs text-muted-foreground">
                /{category.slug}
              </span>
            </summary>
            <form
              action={updateCategoryAction}
              className="mt-4 grid gap-2 md:grid-cols-2"
            >
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                name="nameAr"
                defaultValue={category.nameAr}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
              <input
                name="nameEn"
                defaultValue={category.nameEn}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
              <input
                name="slug"
                defaultValue={category.slug}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
              <input
                name="descriptionAr"
                defaultValue={category.descriptionAr ?? ""}
                placeholder="وصف مختصر"
                className="rounded-md border border-border bg-background px-3 py-2"
              />
              <button
                type="submit"
                className="rounded-md border border-border px-4 py-2 md:col-span-2"
              >
                حفظ التعديلات
              </button>
            </form>
            {isAdmin ? (
              <form action={deleteCategoryAction} className="mt-2">
                <input type="hidden" name="categoryId" value={category.id} />
                <button
                  type="submit"
                  className="rounded-md border border-rose-300 px-3 py-1 text-sm text-rose-600"
                >
                  حذف التصنيف
                </button>
              </form>
            ) : null}
          </details>
        ))}
        {categories.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            لا توجد تصنيفات بعد.
          </p>
        ) : null}
      </section>
    </div>
  );
}
