import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "سياسة الخصوصية",
  description:
    "سياسة الخصوصية: البيانات التي نجمعها، ملفات الكوكيز، روابط العمولة، والإعلانات.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="flex max-w-3xl flex-col gap-4 leading-8">
      <h1 className="text-2xl font-bold">سياسة الخصوصية</h1>
      <p>
        نحترم خصوصيتك. لا نجمع بيانات شخصية إلا عند التواصل معنا طوعاً، ولا
        نبيع أي بيانات لأطراف ثالثة.
      </p>
      <h2 className="text-lg font-semibold">التحليلات وملفات الكوكيز</h2>
      <p>
        قد نستخدم تحليلات مجمّعة لفهم استخدام الموقع. روابط بعض الأدوات قد تكون
        روابط تسويق بالعمولة، ولا تؤثر على تقييمنا لها.
      </p>
      <h2 className="text-lg font-semibold">الإعلانات</h2>
      <p>
        قد نعرض إعلانات أو محتوى مدفوعاً موسوماً بوضوح ومنفصلاً عن المحتوى
        التحريري.
      </p>
    </article>
  );
}
