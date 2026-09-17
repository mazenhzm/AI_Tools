import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRssString } from "@/ingestion/adapters/rss";
import { ParseError } from "@/ingestion/errors";

function fixturePath(name: string): string {
  return resolve(process.cwd(), "tests", "fixtures", "rss", name);
}

describe("parseRssString", () => {
  it("maps valid feed items to raw items", async () => {
    const xml = await readFile(fixturePath("valid.xml"), "utf8");
    const items = await parseRssString(xml);
    expect(items).toHaveLength(3);
    expect(items[0].sourceItemId).toBe("acme-writer-001");
    expect(items[0].title).toBe("Acme Writer");
    expect(items[0].link).toContain("acme-writer.example.com");
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it("returns an empty list for a feed with no items", async () => {
    const items = await parseRssString("<rss><channel><title>x</title></channel></rss>");
    expect(items).toHaveLength(0);
  });

  it("throws ParseError for malformed xml", async () => {
    const xml = await readFile(fixturePath("malformed.xml"), "utf8");
    await expect(parseRssString(xml)).rejects.toBeInstanceOf(ParseError);
  });
});
