import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { AdSlot } from "@/components/site/ad-slot";
import { AffiliateDisclosure } from "@/components/site/affiliate-disclosure";
import { ToolGrid } from "@/components/site/tool-card";
import {
  getActiveSponsorship,
  getToolBySlug,
  listPublicToolSlugs,
} from "@/lib/db/queries/public";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildToolJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { pricingLabel } from "@/lib/ui/labels";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const rows = await listPublicToolSlugs();
    return rows.map((row) => ({ slug: row.slug }));
  } catch (error) {
    console.warn(
      "[public] generateStaticParams(tools) falling back to on-demand rendering:",
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
  const data = await getToolBySlug(slug);
  if (!data) {
    return {
      title: "أداة غير موجودة",
      robots: { index: false, follow: false },
    };
  }
  const { tool, tags } = data;
  return buildPageMetadata({
    title: tool.seoTitleAr || tool.name,
    description:
      tool.seoDescriptionAr ||
      tool.shortDescriptionAr ||
      tool.descriptionAr,
    path: `/tools/${tool.slug}`,
    type: "article",
    keywords: [tool.name, ...tags.map((tag) => tag.name)],
    publishedTime: tool.publishedAt,
    modifiedTime: tool.updatedAt,
  });
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getToolBySlug(slug);
  if (!data) notFound();

  const { tool, category, tags, features, updates, collections, related } = data;
  const sponsorship = await getActiveSponsorship(tool.id);
  const isAffiliate = Boolean(tool.affiliateUrl);
  const ctaUrl = isAffiliate
    ? `/api/track/click?tool=${encodeURIComponent(tool.slug)}`
    : tool.websiteUrl;
  const faq = Array.isArray(tool.faqJson) ? tool.faqJson : [];

  const breadcrumbs = [
    { name: "الرئيسية", url: absoluteUrl("/") },
    { name: "الأدوات", url: absoluteUrl("/tools") },
    ...(category
      ? [
          {
            name: category.nameAr,
            url: absoluteUrl(`/categories/${category.slug}`),
          },
        ]
      : []),
    { name: tool.name, url: absoluteUrl(`/tools/${tool.slug}`) },
  ];

  const faqEntries = faq
    .filter((item) => item.questionAr && item.answerAr)
    .map((item) => ({ question: item.questionAr, answer: item.answerAr }));

  return (
    <div className="flex flex-col gap-8">
      <JsonLd
        data={[
          buildToolJsonLd({
            name: tool.name,
            description:
              tool.shortDescriptionAr ||
              tool.descriptionAr,
            url: absoluteUrl(`/tools/${tool.slug}`),
            categoryName: category?.nameAr ?? null,
            pricingType: tool.pricingType,
            logoUrl: tool.logoUrl,
            publishedAt: tool.publishedAt,
            updatedAt: tool.updatedAt,
          }),
          buildBreadcrumbJsonLd(breadcrumbs),
          ...(faqEntries.length > 0 ? [buildFaqJsonLd(faqEntries)] : []),
        ]}
      />
      <nav className="text-sm text-muted-foreground" aria-label="مسار التصفح">
        <Link href="/" className="hover:underline">
          الرئيسية
        </Link>
        <span className="mx-1">/</span>
        <Link href="/tools" className="hover:underline">
          الأدوات
        </Link>
        {category ? (
          <>
            <span className="mx-1">/</span>
            <Link href={`/categories/${category.slug}`} className="hover:underline">
              {category.nameAr}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="flex flex-col gap-4 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{tool.name}</h1>
          {tool.isFeatured ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              مميّزة
            </span>
          ) : null}
          {sponsorship ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              مُموَّل
            </span>
          ) : null}
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            {pricingLabel(tool.pricingType)}
          </span>
        </div>
        {tool.shortDescriptionAr ? (
          <p className="text-muted-foreground">{tool.shortDescriptionAr}</p>
        ) : null}
        {ctaUrl ? (
          <div className="flex flex-col gap-2">
            <div>
              <a
                href={ctaUrl}
                target="_blank"
                rel={isAffiliate ? "nofollow sponsored noopener" : "nofollow noopener"}
                className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                زيارة الموقع
              </a>
              {isAffiliate ? (
                <span className="ms-2 text-xs text-muted-foreground">
                  رابط مدفوع
                </span>
              ) : null}
            </div>
            {isAffiliate ? <AffiliateDisclosure /> : null}
          </div>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">نبذة</h2>
            <p className="whitespace-pre-wrap leading-8">{tool.descriptionAr}</p>
            {tool.longDescriptionAr ? (
              <p className="whitespace-pre-wrap leading-8">
                {tool.longDescriptionAr}
              </p>
            ) : null}
          </section>

          {features.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">الميزات</h2>
              <ul className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <li
                    key={feature.nameAr}
                    className="rounded-full border border-border px-3 py-1 text-sm"
                  >
                    {feature.nameAr}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {faq.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">الأسئلة الشائعة</h2>
              {faq.map((item, index) => (
                <details
                  key={index}
                  className="rounded-xl border border-border p-4"
                >
                  <summary className="cursor-pointer font-medium">
                    {item.questionAr}
                  </summary>
                  <p className="mt-2 text-muted-foreground">{item.answerAr}</p>
                </details>
              ))}
            </section>
          ) : null}

          {updates.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">التحديثات</h2>
              <ul className="flex flex-col gap-3">
                {updates.map((update) => (
                  <li
                    key={update.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{update.title}</h3>
                      {update.publishedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {update.publishedAt.toLocaleDateString("ar")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {update.contentAr}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                <Link href="/updates" className="text-primary hover:underline">
                  تابع كل تغيّرات النماذج والأدوات في آخر التحديثات
                </Link>
              </p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border p-4 text-sm">
            <h2 className="mb-2 font-semibold">معلومات</h2>
            <dl className="flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">التسعير</dt>
                <dd>{pricingLabel(tool.pricingType)}</dd>
              </div>
              {tool.pricingNotes ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">ملاحظات</dt>
                  <dd>{tool.pricingNotes}</dd>
                </div>
              ) : null}
              {category ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">التصنيف</dt>
                  <dd>
                    <Link
                      href={`/categories/${category.slug}`}
                      className="hover:underline"
                    >
                      {category.nameAr}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {tool.publishedAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">تاريخ النشر</dt>
                  <dd>{tool.publishedAt.toLocaleDateString("ar")}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {tags.length > 0 ? (
            <section className="rounded-xl border border-border p-4 text-sm">
              <h2 className="mb-2 font-semibold">الوسوم</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/tools?q=${encodeURIComponent(tag.name)}`}
                    className="rounded-full bg-muted px-2 py-0.5 hover:underline"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {collections.length > 0 ? (
            <section className="rounded-xl border border-border p-4 text-sm">
              <h2 className="mb-2 font-semibold">تظهر في</h2>
              <ul className="flex flex-col gap-1">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <Link
                      href={`/collections/${collection.slug}`}
                      className="hover:underline"
                    >
                      {collection.titleAr}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <AdSlot placement="sidebar" />
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">أدوات مشابهة</h2>
          <ToolGrid tools={related} />
        </section>
      ) : null}
    </div>
  );
}
