import { describe, it, expect, beforeEach } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata as verifyMetadata } from "@/app/(public)/alerts/verify/page";
import { metadata as subscribedMetadata } from "@/app/(public)/alerts/subscribed/page";
import { metadata as unsubscribeMetadata } from "@/app/(public)/alerts/unsubscribe/page";
import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import { absoluteUrl, siteOrigin } from "@/lib/seo/site";
import { clearDb } from "../db/helpers";

beforeEach(async () => {
  await clearDb();
});

async function seedCatalog() {
  const [category] = await db
    .insert(schema.categories)
    .values({ nameAr: "تصنيف", nameEn: "Category", slug: "cat" })
    .returning();

  await db.insert(schema.tools).values([
    {
      name: "Published Tool",
      slug: "published-tool",
      categoryId: category.id,
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      name: "Draft Tool",
      slug: "draft-tool",
      categoryId: category.id,
      status: "draft",
    },
  ]);

  await db.insert(schema.collections).values([
    {
      titleAr: "قائمة منشورة",
      titleEn: "Published Collection",
      slug: "published-collection",
      status: "published",
    },
    {
      titleAr: "قائمة مسودة",
      titleEn: "Draft Collection",
      slug: "draft-collection",
      status: "draft",
    },
  ]);

  return { category };
}

describe("sitemap", () => {
  it("includes static routes, published tools, categories and collections", async () => {
    await seedCatalog();
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(absoluteUrl("/"));
    expect(urls).toContain(absoluteUrl("/tools"));
    expect(urls).toContain(absoluteUrl("/categories"));
    expect(urls).toContain(absoluteUrl("/collections"));
    expect(urls).toContain(absoluteUrl("/categories/cat"));
    expect(urls).toContain(absoluteUrl("/tools/published-tool"));
    expect(urls).toContain(absoluteUrl("/collections/published-collection"));
  });

  it("excludes unpublished tools and collections", async () => {
    await seedCatalog();
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).not.toContain(absoluteUrl("/tools/draft-tool"));
    expect(urls).not.toContain(absoluteUrl("/collections/draft-collection"));
  });

  it("attaches lastModified for tool entries", async () => {
    await seedCatalog();
    const entry = (await sitemap()).find(
      (item) => item.url === absoluteUrl("/tools/published-tool"),
    );
    expect(entry?.lastModified).toBeInstanceOf(Date);
  });
});

describe("robots", () => {
  it("allows crawling but blocks admin, api and search", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.flatMap((rule) =>
      Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow ?? ""],
    );
    expect(disallow).toContain("/admin");
    expect(disallow.some((value) => value.startsWith("/api"))).toBe(true);
    expect(disallow).toContain("/search");
  });

  it("points to the absolute sitemap url and host", () => {
    const result = robots();
    expect(result.sitemap).toBe(absoluteUrl("/sitemap.xml"));
    expect(result.host).toBe(siteOrigin());
  });
});

describe("transactional alert pages", () => {
  it("are never indexed (token query parameters must not be crawled)", () => {
    for (const metadata of [verifyMetadata, subscribedMetadata, unsubscribeMetadata]) {
      expect(metadata.robots).toEqual({ index: false, follow: true });
      const canonical = metadata.alternates?.canonical;
      expect(typeof canonical).toBe("string");
    }
  });
});
