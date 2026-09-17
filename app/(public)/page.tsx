import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/site/ad-slot";
import { JsonLd } from "@/components/seo/json-ld";
import { ToolGrid } from "@/components/site/tool-card";
import {
  countPublishedTools,
  listActiveSponsoredTools,
  listFeaturedTools,
  listLatestTools,
  listPublicCategories,
  listPublicCollections,
} from "@/lib/db/queries/public";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION_AR, SITE_NAME_AR } from "@/lib/seo/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_NAME_AR} — دليل واكتشاف`,
  description: SITE_DESCRIPTION_AR,
  path: "/",
  titleAbsolute: true,
});

export default async function HomePage() {
  const [featured, latest, categories, collections, total, sponsored] =
    await Promise.all([
      listFeaturedTools(6),
      listLatestTools(9),
      listPublicCategories(),
      listPublicCollections(),
      countPublishedTools(),
      listActiveSponsoredTools("featured", 3),
    ]);

  return (
    <div className="flex flex-col gap-10">
      <JsonLd data={[buildOrganizationJsonLd(), buildWebsiteJsonLd()]} />
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold sm:text-3xl">
          اكتشف أدوات الذكاء الاصطناعي المناسبة لك
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          دليل عربي لأدوات الذكاء الاصطناعي: مراجعات واضحة، تصنيفات دقيقة،
          ومقارنات تساعدك على الاختيار.{" "}
          {total > 0 ? `${total} أداة منشورة حتى الآن.` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/tools"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            تصفح كل الأدوات
          </Link>
          <Link
            href="/categories"
            className="rounded-md border border-border px-4 py-2 transition-colors hover:bg-accent"
          >
            التصنيفات
          </Link>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">أدوات مميّزة</h2>
            <Link href="/tools?featured=1" className="text-sm underline">
              عرض الكل
            </Link>
          </div>
          <ToolGrid tools={featured} />
        </section>
      ) : null}

      {sponsored.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">أدوات مُموَّلة</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              محتوى مدفوع
            </span>
          </div>
          <ToolGrid tools={sponsored} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">أحدث الأدوات</h2>
        <ToolGrid tools={latest} />
        {latest.length > 0 ? (
          <div>
            <Link href="/tools" className="text-sm underline">
              تصفح كل الأدوات
            </Link>
          </div>
        ) : null}
      </section>

      <AdSlot placement="inContent" />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">التصنيفات</h2>
          <Link href="/categories" className="text-sm underline">
            عرض الكل
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
            >
              {category.nameAr}
              <span className="ms-1 text-xs text-muted-foreground">
                {category.toolCount}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {collections.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">قوائم منسّقة</h2>
            <Link href="/collections" className="text-sm underline">
              عرض الكل
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <article
                key={collection.id}
                className="rounded-xl border border-border p-4"
              >
                <h3 className="font-semibold">
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="hover:underline"
                  >
                    {collection.titleAr}
                  </Link>
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {collection.descriptionAr ?? ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {collection.toolCount} أداة
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
