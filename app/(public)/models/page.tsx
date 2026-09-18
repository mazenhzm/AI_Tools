import type { Metadata } from "next";
import { ModelGrid } from "@/components/site/model-card";
import { Pagination } from "@/components/site/pagination";
import {
  listModelProviders,
  listPublicModels,
} from "@/lib/db/queries/models";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const revalidate = 600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; openSource?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(params.provider || params.openSource);
  return buildPageMetadata({
    title: "دليل نماذج الذكاء الاصطناعي",
    description:
      "ميتاكاتالوج نماذج الذكاء الاصطناعي: تتبّع إصدارات النماذج وأسعارها ونافذة السياق والتوفر، مع فلترة حسب الموفّر والمصدر المفتوح.",
    path: "/models",
    noIndex: filtered,
  });
}

export default async function ModelsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string;
    openSource?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const [providers, result] = await Promise.all([
    listModelProviders(),
    listPublicModels({
      providerSlug: params.provider,
      openSource: params.openSource === "1",
      sort: "newest",
      page: Number.isFinite(page) ? page : 1,
      pageSize: 12,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">دليل نماذج الذكاء الاصطناعي</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} نموذجاً منشوراً — تُجمع حقولها من مصادر موثوقة فقط.
        </p>
      </header>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>الموفّر</span>
          <select
            name="provider"
            defaultValue={params.provider ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">كل الموفّرين</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.slug}>
                {provider.name} ({provider.modelCount})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>الترتيب</span>
          <select
            name="sort"
            defaultValue="newest"
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="newest">الأحدث</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm py-2">
          <input
            type="checkbox"
            name="openSource"
            value="1"
            defaultChecked={params.openSource === "1"}
          />
          <span>المصدر المفتوح فقط</span>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تطبيق
          </button>
        </div>
        <p className="col-span-full text-xs text-muted-foreground">
          ملاحظة: الترتيب المتوفر هو «الأحدث»؛ الترتيب «الأكثر استخداماً» غير
          موجود لدينا لأنه يتطلب إحصائية استخدام حقيقية ولا نختلقها.
        </p>
      </form>

      <ModelGrid models={result.items} />

      <Pagination
        basePath="/models"
        params={{
          provider: params.provider,
          openSource: params.openSource,
          sort: params.sort === "newest" ? undefined : params.sort,
        }}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}