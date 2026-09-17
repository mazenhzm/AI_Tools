import { describe, it, expect } from "vitest";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildToolJsonLd,
  buildWebsiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, siteOrigin } from "@/lib/seo/site";

describe("seo url helpers", () => {
  it("normalizes the origin and builds absolute urls", () => {
    const origin = siteOrigin();
    expect(origin.endsWith("/")).toBe(false);
    expect(absoluteUrl("/")).toBe(`${origin}/`);
    expect(absoluteUrl("/tools")).toBe(`${origin}/tools`);
    expect(absoluteUrl("tools/x")).toBe(`${origin}/tools/x`);
  });
});

describe("buildPageMetadata", () => {
  it("sets an absolute canonical url and open graph fields", () => {
    const meta = buildPageMetadata({
      title: "عنوان",
      description: "وصف",
      path: "/tools/sample",
    });
    expect(meta.title).toBe("عنوان");
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/tools/sample"));
    expect(meta.openGraph?.url).toBe(absoluteUrl("/tools/sample"));
    expect(meta.openGraph?.locale).toBe("ar_AR");
    expect((meta.twitter as { card?: string } | undefined)?.card).toBe(
      "summary_large_image",
    );
  });

  it("supports absolute titles for the homepage", () => {
    const meta = buildPageMetadata({
      title: "الرئيسية",
      path: "/",
      titleAbsolute: true,
    });
    expect(meta.title).toEqual({ absolute: "الرئيسية" });
  });

  it("marks filtered views as noindex while staying followable", () => {
    const meta = buildPageMetadata({
      title: "بحث",
      path: "/search",
      noIndex: true,
    });
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });

  it("falls back to the site description when none is provided", () => {
    const meta = buildPageMetadata({ title: "بدون وصف", path: "/about" });
    expect(typeof meta.description).toBe("string");
    expect((meta.description as string).length).toBeGreaterThan(10);
  });
});

describe("json-ld builders", () => {
  it("builds organization and website nodes with a search action", () => {
    const org = buildOrganizationJsonLd();
    expect(org["@type"]).toBe("Organization");

    const site = buildWebsiteJsonLd();
    expect(site["@type"]).toBe("WebSite");
    expect(site.inLanguage).toBe("ar");
    const action = site.potentialAction as Record<string, unknown>;
    const target = action.target as Record<string, unknown>;
    expect(target.urlTemplate).toBe(`${absoluteUrl("/search")}?q={search_term_string}`);
  });

  it("builds a SoftwareApplication node and maps pricing to offers", () => {
    const free = buildToolJsonLd({
      name: "أداة",
      description: "وصف",
      url: absoluteUrl("/tools/x"),
      categoryName: "محادثة",
      pricingType: "free",
    });
    expect(free["@type"]).toBe("SoftwareApplication");
    expect(free.offers).toMatchObject({ price: "0" });

    const paid = buildToolJsonLd({
      name: "أداة",
      description: "وصف",
      url: absoluteUrl("/tools/x"),
      pricingType: "paid",
    });
    expect(paid.offers).toMatchObject({ category: "paid" });

    const unknown = buildToolJsonLd({
      name: "أداة",
      description: "وصف",
      url: absoluteUrl("/tools/x"),
      pricingType: "unknown",
    });
    expect(unknown.offers).toBeUndefined();
  });

  it("never fabricates rating data", () => {
    const node = buildToolJsonLd({
      name: "أداة",
      description: "وصف",
      url: absoluteUrl("/tools/x"),
      pricingType: "freemium",
      publishedAt: new Date("2026-01-02T03:04:05.000Z"),
    });
    expect(node.aggregateRating).toBeUndefined();
    expect(node.datePublished).toBe("2026-01-02T03:04:05.000Z");
  });

  it("builds breadcrumb positions in order", () => {
    const node = buildBreadcrumbJsonLd([
      { name: "الرئيسية", url: absoluteUrl("/") },
      { name: "الأدوات", url: absoluteUrl("/tools") },
    ]);
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
  });

  it("drops empty FAQ entries", () => {
    const node = buildFaqJsonLd([
      { question: "س", answer: "ج" },
      { question: "  ", answer: "ج" },
      { question: "س2", answer: "" },
    ]);
    const entities = node.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("س");
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets to prevent script breakout", () => {
    const json = serializeJsonLd({ text: "</script><img src=x>" });
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c");
    expect(JSON.parse(json.replace(/\\u003c/g, "<"))).toMatchObject({
      text: "</script><img src=x>",
    });
  });

  it("serializes arrays of nodes", () => {
    const json = serializeJsonLd([
      buildOrganizationJsonLd(),
      buildWebsiteJsonLd(),
    ]);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(2);
  });
});
