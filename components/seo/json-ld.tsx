import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/json-ld";

export function JsonLd({
  data,
}: {
  data: JsonLdNode | JsonLdNode[] | JsonLdNode[][];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
