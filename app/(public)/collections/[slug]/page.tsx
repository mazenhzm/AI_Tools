import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { ToolGrid } from "@/components/site/tool-card";
import {
  getCollectionBySlug,
  listPublicCollectionSlugs,
} from "@/lib/db/queries/public";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 600;

export async function generateStaticParams() {
  try {
    const rows = await listPublicCollectionSlugs();
    return rows.map((row) => ({ slug: row.slug }));
  } catch (error) {
    console.warn(
      "[public] generateStaticParams(collections) falling back to on-demand rendering:",
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
  const data = await getCollectionBySlug(slug);
  if (!data) {
    return {
      title: "قائمة غير موجودة",
      robots: { index: false, follow: false },
    };
  }
  return buildPageMetadata({
    title: data.collection.seoTitleAr || data.collection.titleAr,
    description:
      data.collection.seoDescriptionAr ||
      data.collection.descriptionAr ||
      `قائمة منسّقة: ${data.collection.titleAr}.`,
    path: `/collections/${data.collection.slug}`,
    modifiedTime: data.collection.updatedAt,
  });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCollectionBySlug(slug);
  if (!data) notFound();

  const { collection, tools } = data;

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "الرئيسية", url: absoluteUrl("/") },
          { name: "القوائم", url: absoluteUrl("/collections") },
          {
            name: collection.titleAr,
            url: absoluteUrl(`/collections/${collection.slug}`),
          },
        ])}
      />
      <nav className="text-sm text-muted-foreground" aria-label="مسار التصفح">
        <Link href="/" className="hover:underline">
          الرئيسية
        </Link>
        <span className="mx-1">/</span>
        <Link href="/collections" className="hover:underline">
          القوائم
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{collection.titleAr}</h1>
        {collection.descriptionAr ? (
          <p className="text-muted-foreground">{collection.descriptionAr}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{tools.length} أداة</p>
      </header>

      <ToolGrid tools={tools} />
    </div>
  );
}
