import { SITE_DESCRIPTION_AR, SITE_NAME_AR, SITE_NAME_EN, absoluteUrl } from "@/lib/seo/site";

export type JsonLdNode = Record<string, unknown>;

export interface ToolJsonLdInput {
  name: string;
  description: string;
  url: string;
  categoryName?: string | null;
  pricingType: "free" | "freemium" | "paid" | "unknown";
  logoUrl?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

function iso(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function compact(node: JsonLdNode): JsonLdNode {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function buildOrganizationJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME_AR,
    alternateName: SITE_NAME_EN,
    url: absoluteUrl("/"),
  };
}

export function buildWebsiteJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME_AR,
    alternateName: SITE_NAME_EN,
    url: absoluteUrl("/"),
    inLanguage: "ar",
    description: SITE_DESCRIPTION_AR,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * SoftwareApplication structured data for a published tool.
 * Only real, stored facts are emitted — no ratings or offers are invented.
 */
export function buildToolJsonLd(input: ToolJsonLdInput): JsonLdNode {
  const offers =
    input.pricingType === "free"
      ? { "@type": "Offer", price: "0", priceCurrency: "USD" }
      : input.pricingType === "freemium" || input.pricingType === "paid"
        ? { "@type": "Offer", category: input.pricingType }
        : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: input.categoryName ?? undefined,
    operatingSystem: "Web",
    inLanguage: "ar",
    image: input.logoUrl ?? undefined,
    datePublished: iso(input.publishedAt),
    dateModified: iso(input.updatedAt),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME_AR,
      url: absoluteUrl("/"),
    },
    offers,
  });
}

export interface ModelJsonLdInput {
  name: string;
  description: string;
  url: string;
  providerName?: string | null;
  isDownloadable: boolean;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}

/**
 * Structured data for a published AI model card. Downloadable models are
 * SoftwareApplication; the rest are Product. Only real stored facts are
 * emitted — never ratings, usage or ad-hoc offers.
 */
export function buildModelJsonLd(input: ModelJsonLdInput): JsonLdNode {
  const brand = input.providerName
    ? { "@type": "Organization", name: input.providerName }
    : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": input.isDownloadable ? "SoftwareApplication" : "Product",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: "ar",
    datePublished: iso(input.publishedAt),
    dateModified: iso(input.updatedAt),
    brand,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME_AR,
      url: absoluteUrl("/"),
    },
  });
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** FAQPage data — entries missing a question or answer are dropped. */
export function buildFaqJsonLd(entries: FaqEntry[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries
      .filter((entry) => entry.question.trim() && entry.answer.trim())
      .map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
  };
}

/** Serialize JSON-LD safely for embedding in a <script> tag. */
export function serializeJsonLd(
  data: JsonLdNode | JsonLdNode[] | JsonLdNode[][],
): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
