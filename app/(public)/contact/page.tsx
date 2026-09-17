import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "اتصل بنا",
  description:
    "تواصل مع فريق المنصة للاستفسارات أو طلبات إضافة أداة أو تصحيح معلومة.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <article className="flex max-w-3xl flex-col gap-4 leading-8">
      <h1 className="text-2xl font-bold">اتصل بنا</h1>
      <p>
        للاستفسارات أو طلبات إضافة أداة أو تصحيح معلومة، يمكنك مراسلتنا عبر
        البريد الإلكتروني:
      </p>
      <p className="font-medium">support@example.com</p>
      <p className="text-sm text-muted-foreground">
        نراجع الرسائل خلال أيام العمل ونحدّث البيانات عند ثبوت أي خطأ.
      </p>
    </article>
  );
}
