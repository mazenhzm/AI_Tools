import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ParseError, ValidationError } from "../errors";
import { mapFeedItems, parseRssString } from "./rss";
import type { AdapterContext, RawSourceItem, SourceAdapter } from "../types";

interface FixtureJsonItem {
  id?: string;
  sourceItemId?: string;
  title?: string;
  link?: string;
  url?: string;
  summary?: string;
  content?: string;
  publishedAt?: string;
  author?: string;
}

function fromJson(value: unknown): RawSourceItem[] {
  if (!Array.isArray(value)) {
    throw new ParseError("fixture JSON must be an array of items");
  }
  return value.map((entry, index) => {
    const item = entry as FixtureJsonItem;
    const link = item.link ?? item.url ?? null;
    const sourceItemId =
      item.sourceItemId ?? item.id ?? link ?? `fixture-${index}`;
    if (!item.title && !link) {
      throw new ValidationError(
        `fixture item ${index} has neither title nor link`,
      );
    }
    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
    return {
      sourceItemId,
      title: item.title ?? null,
      link,
      summary: item.summary ?? null,
      content: item.content ?? null,
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt
          : null,
      author: item.author ?? null,
      raw: item as Record<string, unknown>,
    } satisfies RawSourceItem;
  });
}

export async function parseFixtureContent(
  text: string,
): Promise<RawSourceItem[]> {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    return parseRssString(trimmed);
  }
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (err) {
    throw new ParseError(
      `fixture is neither XML nor valid JSON: ${(err as Error).message}`,
      err,
    );
  }
  return fromJson(json);
}

/**
 * Offline adapter used for deterministic demos and tests. It reads a fixture
 * from `config.fixtureInline` (raw text) or `config.fixturePath` (file path).
 */
export const fixtureAdapter: SourceAdapter = {
  key: "fixture:inline",
  label: "Local fixture (offline)",
  async fetchItems(ctx: AdapterContext): Promise<RawSourceItem[]> {
    const config = (ctx.source.config ?? {}) as Record<string, unknown>;
    const inline = config.fixtureInline;
    if (typeof inline === "string" && inline.trim().length > 0) {
      return parseFixtureContent(inline);
    }
    const path = config.fixturePath;
    if (typeof path === "string" && path.trim().length > 0) {
      const abs = resolve(/* turbopackIgnore: true */ process.cwd(), path);
      let text: string;
      try {
        text = await readFile(abs, "utf8");
      } catch (err) {
        throw new ParseError(
          `cannot read fixture file ${abs}: ${(err as Error).message}`,
          err,
        );
      }
      return parseFixtureContent(text);
    }
    throw new ParseError(
      "fixture source requires config.fixtureInline or config.fixturePath",
    );
  },
};

export { mapFeedItems };
