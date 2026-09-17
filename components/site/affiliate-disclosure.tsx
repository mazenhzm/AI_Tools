import Link from "next/link";

/**
 * Plain-language affiliate disclosure. Rendered next to affiliate CTAs and on
 * the privacy page; the same text is never hidden behind a tooltip.
 */
export function AffiliateDisclosure({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
      إفصاح: بعض الروابط في هذه الصفحة روابط تسويق بالعمولة، وقد نحصل على عمولة
      عند الشراء عبرها دون أي تكلفة إضافية عليك.{" "}
      <Link href="/privacy" className="underline">
        سياسة الخصوصية
      </Link>
      .
    </p>
  );
}
