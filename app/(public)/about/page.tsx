import type { Metadata } from "next";
import { countPublishedTools, listPublicCategories } from "@/lib/db/queries/public";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "من نحن",
  description:
    "تعرف على منصة أدوات الذكاء الاصطناعي: كيفية جمع البيانات، المعالجة الآلية، المراجعة البشرية، ومعايير النشر.",
  path: "/about",
});

export default async function AboutPage() {
  const [total, categories] = await Promise.all([
    countPublishedTools(),
    listPublicCategories(),
  ]);

  return (
    <article className="flex max-w-3xl flex-col gap-4 leading-8">
      <h1 className="text-2xl font-bold">من نحن</h1>
      <p>
        منصة عربية لاكتشاف أدوات الذكاء الاصطناعي ومراجعتها. نجمع الأدوات من
        مصادر موثوقة، ثم نعالج بياناتها ونراجعها بشرياً قبل النشر، بهدف تقديم
        وصف عربي واضح ومعلومات دقيقة عن التسعير والتصنيف.
      </p>
      <h2 className="text-lg font-semibold">كيف نعمل</h2>
      <ul className="list-inside list-disc text-muted-foreground">
        <li>جمع البيانات من مصادر معلنة مع حفظ المصدر الأصلي.</li>
        <li>معالجة آلية لصياغة وصف عربي وإنجليزي دون اختراع حقائق.</li>
        <li>مراجعة بشرية ودرجة جودة قبل النشر.</li>
        <li>تحديث مستمر للمعلومات.</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        حالياً {total} أداة منشورة ضمن {categories.length} تصنيفاً.
      </p>
    </article>
  );
}
