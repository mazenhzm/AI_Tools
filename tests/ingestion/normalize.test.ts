import { describe, it, expect } from "vitest";
import { normalizeItem } from "@/ingestion/normalize";
import { normalizeName, slugify, stripHtml } from "@/lib/utils/text";
import { normalizeUrl } from "@/lib/utils/url";
import type { RawSourceItem } from "@/ingestion/types";

function raw(partial: Partial<RawSourceItem>): RawSourceItem {
  return {
    sourceItemId: "id-1",
    title: null,
    link: null,
    summary: null,
    content: null,
    publishedAt: null,
    author: null,
    raw: {},
    ...partial,
  };
}

describe("slugify", () => {
  it("lowercases latin and keeps it url-safe", () => {
    expect(slugify("Acme Writer Pro!")).toBe("acme-writer-pro");
  });
  it("preserves arabic letters while folding hamza variants for stability", () => {
    expect(slugify("أدوات الذكاء الاصطناعي")).toBe(
      "ادوات-الذكاء-الاصطناعي",
    );
  });
});

describe("normalizeName", () => {
  it("strips noise words and punctuation", () => {
    expect(normalizeName("Acme AI, Inc.")).toBe("acme");
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes basic entities", () => {
    expect(stripHtml("<p>Hello &amp; <b>world</b></p>")).toBe("Hello & world");
  });
});

describe("normalizeUrl", () => {
  it("strips tracking params, www, fragment and trailing slash", () => {
    expect(
      normalizeUrl("https://WWW.Example.com/Path/?utm_source=x&b=2&a=1#frag"),
    ).toBe("https://example.com/Path?a=1&b=2");
  });
  it("returns null for non-http urls", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("normalizeItem", () => {
  it("normalizes a complete item", () => {
    const item = normalizeItem(
      raw({
        title: "Acme Writer",
        link: "https://www.acme-writer.example.com/?utm_source=rss",
        summary: "<p>Write better, faster.</p>",
      }),
    );
    expect(item.name).toBe("Acme Writer");
    expect(item.slug).toBe("acme-writer");
    expect(item.websiteUrl).toBe("https://acme-writer.example.com");
    expect(item.domain).toBe("acme-writer.example.com");
    expect(item.summary).toBe("Write better, faster.");
    expect(item.contentHash).toHaveLength(64);
  });

  it("rejects items with no usable title", () => {
    expect(() => normalizeItem(raw({ title: null, summary: null }))).toThrow(
      /no usable name/,
    );
  });

  it("accepts items without a link", () => {
    const item = normalizeItem(raw({ title: "No Link Tool" }));
    expect(item.websiteUrl).toBeNull();
    expect(item.domain).toBeNull();
  });

  it("preserves arabic characters in the display name", () => {
    const item = normalizeItem(raw({ title: "أدوات الذكاء الاصطناعي" }));
    expect(item.name).toBe("أدوات الذكاء الاصطناعي");
    expect(item.slug).toBe("ادوات-الذكاء-الاصطناعي");
  });
});
