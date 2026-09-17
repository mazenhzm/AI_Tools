import Parser from "rss-parser";
import { sha256 } from "@/lib/utils/hash";
import { ParseError } from "../errors";
import type { AdapterContext, RawSourceItem, SourceAdapter } from "../types";

interface RssItemLike {
  guid?: string;
  id?: string;
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  [key: string]: unknown;
}

function parseDate(item: RssItemLike): Date | null {
  const candidates = [item.isoDate, item.pubDate];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function stableId(item: RssItemLike): string {
  const explicit = [item.guid, item.id, item.link].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (explicit) return String(explicit).trim();
  return sha256(
    `${item.title ?? ""}\u0000${item.pubDate ?? item.isoDate ?? ""}`,
  ).slice(0, 32);
}

/** Pure mapping from parsed feed entries to raw items (exported for testing). */
export function mapFeedItems(items: RssItemLike[]): RawSourceItem[] {
  return items.map((item) => ({
    sourceItemId: stableId(item),
    title: item.title ?? null,
    link: item.link ?? null,
    summary: item.contentSnippet ?? item.summary ?? null,
    content: item.content ?? null,
    publishedAt: parseDate(item),
    author: item.creator ?? item.author ?? null,
    raw: item,
  }));
}

export async function parseRssString(xml: string): Promise<RawSourceItem[]> {
  const parser = new Parser({ defaultRSS: 2.0 });
  try {
    const feed = await parser.parseString(xml);
    return mapFeedItems((feed.items ?? []) as RssItemLike[]);
  } catch (err) {
    throw new ParseError(`invalid RSS/Atom feed: ${(err as Error).message}`, err);
  }
}

export const rssAdapter: SourceAdapter = {
  key: "rss:generic",
  label: "RSS / Atom feed",
  async fetchItems(ctx: AdapterContext): Promise<RawSourceItem[]> {
    const url = ctx.source.url;
    if (!url) throw new ParseError("source has no url configured");
    const xml = await ctx.httpGet(url);
    return parseRssString(xml);
  },
};
