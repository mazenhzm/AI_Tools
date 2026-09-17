import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublicCollections } from "@/lib/db/queries/public";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "القوائم المنسّقة",
  description:
    "قوائم مختارة لأفضل أدوات الذكاء الاصطناعي حسب الاستخدام: كتابة، صور، برمجة، إنتاجية.",
  path: "/collections",
});

export default async function CollectionsPage() {
  const collections = await listPublicCollections();

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "الرئيسية", url: absoluteUrl("/") },
          { name: "القوائم", url: absoluteUrl("/collections") },
        ])}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">القوائم المنسّقة</h1>
        <p className="text-sm text-muted-foreground">
          مجموعات مختارة يدوياً لمساعدتك على الوصول إلى الأداة المناسبة بسرعة.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <article
            key={collection.id}
            className="rounded-xl border border-border p-4"
          >
            <h2 className="font-semibold">
              <Link
                href={`/collections/${collection.slug}`}
                className="hover:underline"
              >
                {collection.titleAr}
              </Link>
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {collection.descriptionAr ?? collection.titleEn}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {collection.toolCount} أداة
            </p>
          </article>
        ))}
        {collections.length === 0 ? (
          <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            لا توجد قوائم منشورة بعد.
          </p>
        ) : null}
      </div>
    </div>
  );
}
