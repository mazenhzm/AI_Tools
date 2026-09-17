import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublicCategories } from "@/lib/db/queries/public";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "التصنيفات",
  description:
    "تصفح أدوات الذكاء الاصطناعي حسب التصنيف: محادثة، توليد صور، أدوات مطورين، إنتاجية وغيرها.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await listPublicCategories();

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "الرئيسية", url: absoluteUrl("/") },
          { name: "التصنيفات", url: absoluteUrl("/categories") },
        ])}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">التصنيفات</h1>
        <p className="text-sm text-muted-foreground">
          اختر تصنيفاً لاستعراض الأدوات المرتبطة به.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <article
            key={category.id}
            className="rounded-xl border border-border p-4"
          >
            <h2 className="font-semibold">
              <Link
                href={`/categories/${category.slug}`}
                className="hover:underline"
              >
                {category.nameAr}
              </Link>
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {category.descriptionAr ?? category.nameEn}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {category.toolCount} أداة
            </p>
          </article>
        ))}
        {categories.length === 0 ? (
          <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            لا توجد تصنيفات بعد.
          </p>
        ) : null}
      </div>
    </div>
  );
}
