import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { ToolGrid } from "@/components/site/tool-card";
import {
  getCategoryBySlug,
  listPublicCategorySlugs,
  listPublicTools,
} from "@/lib/db/queries/public";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 600;

export async function generateStaticParams() {
  try {
    const rows = await listPublicCategorySlugs();
    return rows.map((row) => ({ slug: row.slug }));
  } catch (error) {
    console.warn(
      "[public] generateStaticParams(categories) falling back to on-demand rendering:",
      error,
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return {
      title: "تصنيف غير موجود",
      robots: { index: false, follow: false },
    };
  }
  return buildPageMetadata({
    title: category.seoTitleAr || category.nameAr,
    description:
      category.seoDescriptionAr ||
      category.descriptionAr ||
      `أدوات الذكاء الاصطناعي في تصنيف ${category.nameAr}.`,
    path: `/categories/${category.slug}`,
    modifiedTime: category.updatedAt,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const result = await listPublicTools({
    categorySlug: slug,
    sort: "newest",
    pageSize: 24,
  });

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "الرئيسية", url: absoluteUrl("/") },
          { name: "التصنيفات", url: absoluteUrl("/categories") },
          {
            name: category.nameAr,
            url: absoluteUrl(`/categories/${category.slug}`),
          },
        ])}
      />
      <nav className="text-sm text-muted-foreground" aria-label="مسار التصفح">
        <Link href="/" className="hover:underline">
          الرئيسية
        </Link>
        <span className="mx-1">/</span>
        <Link href="/categories" className="hover:underline">
          التصنيفات
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{category.nameAr}</h1>
        {category.descriptionAr ? (
          <p className="text-muted-foreground">{category.descriptionAr}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{result.total} أداة</p>
      </header>

      <ToolGrid tools={result.items} />

      {result.total > result.items.length ? (
        <p className="text-sm">
          <Link
            href={`/tools?category=${encodeURIComponent(slug)}`}
            className="hover:underline"
          >
            عرض كل الأدوات في هذا التصنيف ({result.total})
          </Link>
        </p>
      ) : null}
    </div>
  );
}
