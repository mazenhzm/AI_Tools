import type { MetadataRoute } from "next";
import {
  listPublicCategorySlugs,
  listPublicCollectionSlugs,
  listPublicToolSlugs,
} from "@/lib/db/queries/public";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
  { url: absoluteUrl("/tools"), changeFrequency: "daily", priority: 0.9 },
  { url: absoluteUrl("/categories"), changeFrequency: "weekly", priority: 0.7 },
  { url: absoluteUrl("/collections"), changeFrequency: "weekly", priority: 0.7 },
  { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.3 },
  { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.2 },
  { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
  { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.1 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [tools, categories, collections] = await Promise.all([
      listPublicToolSlugs(),
      listPublicCategorySlugs(),
      listPublicCollectionSlugs(),
    ]);

    return [
      ...STATIC_ROUTES,
      ...categories.map((row) => ({
        url: absoluteUrl(`/categories/${row.slug}`),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...collections.map((row) => ({
        url: absoluteUrl(`/collections/${row.slug}`),
        lastModified: row.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...tools.map((row) => ({
        url: absoluteUrl(`/tools/${row.slug}`),
        lastModified: row.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    console.warn(
      "[seo] sitemap falling back to static routes only (database unavailable):",
      error,
    );
    return STATIC_ROUTES;
  }
}
