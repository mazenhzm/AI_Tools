import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublicUpdates } from "@/lib/db/queries/updates";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "آخر التحديثات",
  description:
    "تابع أحدث التغييرات في عالم نماذج وأدوات الذكاء الاصطناعي: أسعار، إصدارات، نافذة سياق — كلها مراقبة ومُراجعة من مصادر موثوقة.",
  path: "/updates",
});

export default async function UpdatesPage() {
  const feeds = await listPublicUpdates({ limit: 50 });

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "الرئيسية", url: absoluteUrl("/") },
          { name: "آخر التحديثات", url: absoluteUrl("/updates") },
        ])}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">آخر التحديثات</h1>
        <p className="text-sm text-muted-foreground">
          كل تغيّر في أسعار النماذج أو إصداراتها أو نافذة سياقها أو توافرها —
          يظهر هنا بمجرد رصده ومراجعته من مصادر موثوقة.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {feeds.map((item) => (
          <article
            key={`${item.kind}:${item.id}`}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-accent px-2 py-0.5">
                {item.kind === "model" ? "نموذج" : "أداة"}
              </span>
              <Link
                href={
                  item.kind === "model"
                    ? `/models/${item.entitySlug}`
                    : `/tools/${item.entitySlug}`
                }
                className="font-medium text-foreground hover:underline"
              >
                {item.entityName}
              </Link>
              {item.providerName ? (
                <span className="text-muted-foreground">{item.providerName}</span>
              ) : null}
              {item.publishedAt ? (
                <span className="ms-auto text-muted-foreground">
                  {item.publishedAt.toLocaleDateString("ar", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.contentAr}</p>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                المصدر
              </a>
            ) : null}
          </article>
        ))}
        {feeds.length === 0 ? (
          <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            لا توجد تحديثات منشورة بعد.
          </p>
        ) : null}
      </div>
    </div>
  );
}