import type { Metadata } from "next";
import {
  SITE_DESCRIPTION_AR,
  SITE_KEYWORDS_AR,
  SITE_NAME_AR,
  absoluteUrl,
} from "@/lib/seo/site";

export interface PageMetadataInput {
  title: string;
  description?: string | null;
  path: string;
  type?: "website" | "article";
  noIndex?: boolean;
  titleAbsolute?: boolean;
  keywords?: string[];
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
}

/** Shared metadata builder: canonical URL, Open Graph and Twitter cards. */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const description = input.description?.trim() || SITE_DESCRIPTION_AR;

  return {
    title: input.titleAbsolute ? { absolute: input.title } : input.title,
    description,
    keywords: input.keywords ?? SITE_KEYWORDS_AR,
    alternates: { canonical: url },
    robots: input.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: input.type ?? "website",
      title: input.title,
      description,
      url,
      siteName: SITE_NAME_AR,
      locale: "ar_AR",
      publishedTime: input.publishedTime?.toISOString(),
      modifiedTime: input.modifiedTime?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
    },
  };
}
