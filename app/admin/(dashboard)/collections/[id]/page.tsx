import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setCollectionStatusAction,
  setCollectionToolsAction,
  updateCollectionAction,
} from "@/lib/actions/catalog";
import { getCollectionForAdmin } from "@/lib/db/queries/catalog";
import {
  CONTENT_STATUS_VALUES,
  contentStatusLabel,
  toolStatusLabel,
} from "@/lib/ui/labels";

function HiddenIds({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} type="hidden" name="toolIds" value={id} />
      ))}
    </>
  );
}

export default async function AdminCollectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  const data = await getCollectionForAdmin(id);
  if (!data) notFound();

  const { collection, members, availableTools } = data;
  const orderedIds = members.map((member) => member.toolId);
  const memberIds = new Set(orderedIds);
  const selectable = availableTools.filter((tool) => !memberIds.has(tool.id));

  function reordered(index: number, delta: number): string[] {
    const next = [...orderedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/collections" className="text-sm underline">
          ← القوائم
        </Link>
        <h1 className="text-xl font-bold">{collection.titleAr}</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {contentStatusLabel(collection.status)}
        </span>
      </div>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-3 font-semibold">بيانات القائمة</h2>
        <form
          action={updateCollectionAction}
          className="grid gap-2 md:grid-cols-2"
        >
          <input type="hidden" name="collectionId" value={collection.id} />
          <input
            name="titleAr"
            defaultValue={collection.titleAr}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="titleEn"
            defaultValue={collection.titleEn}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="slug"
            defaultValue={collection.slug}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
          <input
            name="descriptionAr"
            defaultValue={collection.descriptionAr ?? ""}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {CONTENT_STATUS_VALUES.map((status) => (
            <form key={status} action={setCollectionStatusAction}>
              <input
                type="hidden"
                name="collectionId"
                value={collection.id}
              />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                disabled={status === collection.status}
                className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
              >
                {contentStatusLabel(status)}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <h2 className="font-semibold">الأدوات ({members.length})</h2>

        <ul className="flex flex-col divide-y divide-border">
          {members.map((member, index) => (
            <li
              key={member.toolId}
              className="flex flex-wrap items-center gap-2 py-2"
            >
              <span className="font-medium">{member.name}</span>
              <span className="text-xs text-muted-foreground">
                {toolStatusLabel(member.status)}
              </span>
              <span className="ms-auto flex gap-2">
                <form action={setCollectionToolsAction}>
                  <input
                    type="hidden"
                    name="collectionId"
                    value={collection.id}
                  />
                  <HiddenIds ids={reordered(index, -1)} />
                  <button
                    type="submit"
                    disabled={index === 0}
                    className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    ↑
                  </button>
                </form>
                <form action={setCollectionToolsAction}>
                  <input
                    type="hidden"
                    name="collectionId"
                    value={collection.id}
                  />
                  <HiddenIds ids={reordered(index, 1)} />
                  <button
                    type="submit"
                    disabled={index === members.length - 1}
                    className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    ↓
                  </button>
                </form>
                <form action={setCollectionToolsAction}>
                  <input
                    type="hidden"
                    name="collectionId"
                    value={collection.id}
                  />
                  <HiddenIds
                    ids={orderedIds.filter((toolId) => toolId !== member.toolId)}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600"
                  >
                    إزالة
                  </button>
                </form>
              </span>
            </li>
          ))}
          {members.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">
              لا توجد أدوات في هذه القائمة.
            </li>
          ) : null}
        </ul>

        <form
          action={setCollectionToolsAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="collectionId" value={collection.id} />
          <HiddenIds ids={orderedIds} />
          <label className="flex flex-col gap-1 text-sm">
            <span>إضافة أداة</span>
            <select
              name="toolIds"
              required
              defaultValue=""
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="" disabled>
                اختر أداة
              </option>
              {selectable.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name} ({toolStatusLabel(tool.status)})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            إضافة
          </button>
        </form>
      </section>
    </div>
  );
}
