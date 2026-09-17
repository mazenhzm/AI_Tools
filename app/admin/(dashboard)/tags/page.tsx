import { createTagAction, deleteTagAction } from "@/lib/actions/catalog";
import { auth } from "@/lib/auth";
import { listTagsWithCounts } from "@/lib/db/queries/catalog";

export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const [tags, session] = await Promise.all([
    listTagsWithCounts(),
    auth(),
  ]);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">الوسوم ({tags.length})</h1>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <form action={createTagAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>وسم جديد</span>
          <input
            name="name"
            required
            placeholder="اسم الوسم"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          إضافة
        </button>
      </form>

      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
          >
            <span>{tag.name}</span>
            <span className="text-xs text-muted-foreground">
              {tag.toolCount}
            </span>
            {isAdmin ? (
              <form action={deleteTagAction}>
                <input type="hidden" name="tagId" value={tag.id} />
                <button
                  type="submit"
                  className="text-rose-600"
                  aria-label={`حذف ${tag.name}`}
                >
                  ×
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {tags.length === 0 ? (
          <li className="text-sm text-muted-foreground">لا توجد وسوم.</li>
        ) : null}
      </ul>
    </div>
  );
}
