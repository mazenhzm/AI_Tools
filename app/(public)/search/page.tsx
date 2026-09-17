import type { Metadata } from "next";
import { Pagination } from "@/components/site/pagination";
import { ToolGrid } from "@/components/site/tool-card";
import { listPublicTools } from "@/lib/db/queries/public";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "البحث",
  description: "ابحث في دليل أدوات الذكاء الاصطناعي بالعربية.",
  path: "/search",
  noIndex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Number(params.page ?? "1");

  const result = q
    ? await listPublicTools({
        q,
        sort: "relevance",
        page: Number.isFinite(page) ? page : 1,
        pageSize: 12,
      })
    : { items: [], total: 0, page: 1, pageSize: 12 };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">البحث</h1>
        {q ? (
          <p className="text-sm text-muted-foreground">
            {result.total} نتيجة لـ «{q}»
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            أدخل كلمة للبحث عن أداة.
          </p>
        )}
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span>كلمة البحث</span>
          <input
            name="q"
            defaultValue={q}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          بحث
        </button>
      </form>

      {q ? (
        <>
          <ToolGrid tools={result.items} />
          <Pagination
            basePath="/search"
            params={{ q }}
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
          />
        </>
      ) : null}
    </div>
  );
}
