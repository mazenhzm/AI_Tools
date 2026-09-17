import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "شروط الاستخدام",
  description:
    "شروط استخدام المنصة: دقة المعلومات، الملكية الفكرية، والروابط الخارجية.",
  path: "/terms",
});


export default function TermsPage() {
  return (
    <article className="flex max-w-3xl flex-col gap-4 leading-8">
      <h1 className="text-2xl font-bold">شروط الاستخدام</h1>
      <p>
        المعلومات المنشورة لأغراض تعريفية وتخضع للتحديث. نبذل جهداً معقولاً
        لضمان دقتها، لكننا لا نضمن خلوّها من الأخطاء أو ملاءمتها لغرض معيّن.
      </p>
      <h2 className="text-lg font-semibold">الملكية الفكرية</h2>
      <p>
        أسماء الأدوات وشعاراتها مملوكة لأصحابها. المحتوى التحريري على المنصة
        محمي ولا يجوز إعادة نشره دون إذن.
      </p>
      <h2 className="text-lg font-semibold">الروابط الخارجية</h2>
      <p>
        قد تحتوي الصفحات على روابط لمواقع خارجية أو روابط عمولة، ولا نتحمل
        مسؤولية محتوى تلك المواقع.
      </p>
    </article>
  );
}
