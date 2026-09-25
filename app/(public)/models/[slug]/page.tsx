import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getModelBySlug,
  listPublicModelSlugs,
} from "@/lib/db/queries/models";
import { buildBreadcrumbJsonLd, buildModelJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { modelUpdateKindLabel } from "@/lib/ui/labels";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const rows = await listPublicModelSlugs();
    return rows.map((row) => ({ slug: row.slug }));
  } catch (error) {
    console.warn(
      "[public] generateStaticParams(models) falling back to on-demand rendering:",
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
  const data = await getModelBySlug(slug);
  if (!data) {
    return {
      title: "نموذج غير موجود",
      robots: { index: false, follow: false },
    };
  }
  const { model, provider } = data;
  return buildPageMetadata({
    title: model.name,
    description:
      model.descriptionAr ||
      (provider
        ? `صفحة نموذج ${model.name} من ${provider.name}.`
        : `صفحة نموذج ${model.name}.`),
    path: `/models/${model.slug}`,
    type: "article",
    keywords: [
      model.name,
      model.modelIdentifier,
      provider?.name,
      "نموذج ذكاء اصطناعي",
    ].filter((value): value is string => Boolean(value)),
    publishedTime: model.publishedAt,
    modifiedTime: model.updatedAt,
  });
}

function formatPrice(value: string | null): string | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toLocaleString("en-US");
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getModelBySlug(slug);
  if (!data) notFound();

  const { model, provider, updates } = data;
  const description =
    model.descriptionAr ||
    (provider ? `نموذج ${model.name} من ${provider.name}.` : `نموذج ${model.name}.`);
  const inputPrice = formatPrice(model.inputPricePer1M);
  const outputPrice = formatPrice(model.outputPricePer1M);

  const breadcrumbs = [
    { name: "الرئيسية", url: absoluteUrl("/") },
    { name: "النماذج", url: absoluteUrl("/models") },
    { name: model.name, url: absoluteUrl(`/models/${model.slug}`) },
  ];

  const factRows: Array<[string, React.ReactNode]> = [
    ["الموفّر", provider ? provider.name : "غير معروف"],
    ["المعرّف", model.modelIdentifier || "غير معروف"],
    ["الإصدار الحالي", model.currentVersion || "غير معروف"],
    ["تاريخ الإصدار", model.releaseDate || "غير معروف"],
    [
      "نافذة السياق",
      model.contextWindow
        ? `${model.contextWindow.toLocaleString("en-US")} رمز`
        : "غير معروف",
    ],
    [
      "سعر الدخول (لكل مليون رمز)",
      inputPrice ? `${inputPrice} $` : "غير معروف",
    ],
    [
      "سعر المخرجات (لكل مليون رمز)",
      outputPrice ? `${outputPrice} $` : "غير معروف",
    ],
    ["ملاحظات التسعير", model.pricingNotes || "غير معروف"],
    [
      "أنماط الوسائط",
      model.modalities.length > 0
        ? model.modalities.map((m) => m).join("، ")
        : "غير معروف",
    ],
    ["المصدر المفتوح", model.isDownloadable ? "نعم" : "لا"],
  ];

  return (
    <div className="flex flex-col gap-8">
      <JsonLd
        data={[
          buildModelJsonLd({
            name: model.name,
            description,
            url: absoluteUrl(`/models/${model.slug}`),
            providerName: provider?.name ?? null,
            isDownloadable: model.isDownloadable,
            publishedAt: model.publishedAt,
            updatedAt: model.updatedAt,
          }),
          buildBreadcrumbJsonLd(breadcrumbs),
        ]}
      />
      <nav className="text-sm text-muted-foreground" aria-label="مسار التصفح">
        <Link href="/" className="hover:underline">
          الرئيسية
        </Link>
        <span className="mx-1">/</span>
        <Link href="/models" className="hover:underline">
          النماذج
        </Link>
      </nav>

      <header className="flex flex-col gap-4 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{model.name}</h1>
          {model.isDownloadable ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              مفتوح المصدر
            </span>
          ) : null}
          {provider?.websiteUrl ? (
            <a
              href={provider.websiteUrl}
              target="_blank"
              rel="nofollow noopener"
              className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
            >
              الموقع الرسمي
            </a>
          ) : null}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {updates.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">سجل التغييرات</h2>
              <ul className="flex flex-col gap-3">
                {updates.map((update) => (
                  <li
                    key={update.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{update.title}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {modelUpdateKindLabel(update.kind)}
                      </span>
                      {update.publishedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {update.publishedAt.toLocaleDateString("ar")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {update.contentAr}
                    </p>
                    {update.sourceUrl ? (
                      <a
                        href={update.sourceUrl}
                        target="_blank"
                        rel="nofollow noopener"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        المصدر
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border p-4 text-sm">
            <h2 className="mb-3 font-semibold">البيانات التقنية</h2>
            <dl className="flex flex-col gap-2">
              {factRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {model.publishedAt ? (
              <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                نُشر في {model.publishedAt.toLocaleDateString("ar")}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border p-4 text-sm">
            <h2 className="mb-2 font-semibold">تابِع تغيّرات هذا النموذج</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              ننشر هنا كل تغيّر في الأسعار أو الإصدار أو نافذة السياق بمجرد رصده
              ومراجعته. تابع صفحة آخر التحديثات لمتابعة جميع النماذج.
            </p>
            <Link
              href="/updates"
              className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              آخر التحديثات
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}