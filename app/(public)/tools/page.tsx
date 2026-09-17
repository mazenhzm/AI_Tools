import type { Metadata } from "next";
import { AdSlot } from "@/components/site/ad-slot";
import { ToolGrid } from "@/components/site/tool-card";
import { Pagination } from "@/components/site/pagination";
import {
  isPricingValue,
  listActiveSponsoredTools,
  listPublicCategories,
  listPublicTools,
  type SortValue,
} from "@/lib/db/queries/public";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { pricingLabel } from "@/lib/ui/labels";

const PRICING_OPTIONS = ["free", "freemium", "paid", "unknown"] as const;
const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "الأحدث" },
  { value: "relevance", label: "الأكثر صلة" },
  { value: "name", label: "الاسم" },
];

export const revalidate = 600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    pricing?: string;
    featured?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(
    params.q || params.category || params.pricing || params.featured,
  );
  return buildPageMetadata({
    title: "كل الأدوات",
    description:
      "استعرض دليل أدوات الذكاء الاصطناعي مع البحث والتصنيف والتسعير والترتيب.",
    path: "/tools",
    noIndex: filtered,
  });
}

export default async function ToolsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    pricing?: string;
    featured?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const sort: SortValue =
    params.sort === "name" || params.sort === "relevance"
      ? params.sort
      : "newest";

  const [categories, result, sponsored] = await Promise.all([
    listPublicCategories(),
    listPublicTools({
      q: params.q,
      categorySlug: params.category,
      pricing: params.pricing,
      featuredOnly: params.featured === "1",
      sort,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 12,
    }),
    listActiveSponsoredTools("listings", 2),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">كل الأدوات</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} أداة منشورة
        </p>
      </header>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="flex flex-col gap-1 text-sm lg:col-span-2">
          <span>بحث</span>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="اسم الأداة أو وصفها"
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>التصنيف</span>
          <select
            name="category"
            defaultValue={params.category ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">كل التصنيفات</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>التسعير</span>
          <select
            name="pricing"
            defaultValue={params.pricing ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">الكل</option>
            {PRICING_OPTIONS.filter(isPricingValue).map((value) => (
              <option key={value} value={value}>
                {pricingLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>الترتيب</span>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            value="1"
            defaultChecked={params.featured === "1"}
          />
          <span>المميّزة فقط</span>
        </label>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تطبيق
          </button>
        </div>
      </form>

      <ToolGrid tools={result.items} />

      {sponsored.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">أدوات مُموَّلة</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              محتوى مدفوع
            </span>
          </div>
          <ToolGrid tools={sponsored} />
        </section>
      ) : null}

      <AdSlot placement="listings" />

      <Pagination
        basePath="/tools"
        params={{
          q: params.q,
          category: params.category,
          pricing: params.pricing,
          featured: params.featured,
          sort: params.sort === "newest" ? undefined : params.sort,
        }}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
