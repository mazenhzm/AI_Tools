import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ParseError, ValidationError } from "../errors";
import { parseRssString } from "../adapters/rss";
import { rawModelEntrySchema } from "@/lib/validation/models";
import type { ModelAdapterContext, ModelSourceAdapter, RawModelItem } from "./types";

/**
 * Offline model adapter used for deterministic demos and tests. It reads an
 * array of model entries from `config.fixtureInline` (JSON text) or
 * `config.fixturePath` (file path). XML/RSS feeds are also accepted and mapped
 * to model entries (factual fields will simply be unknown -> NULL).
 */
export function fromModelEntries(value: unknown): RawModelItem[] {
  if (!Array.isArray(value)) {
    throw new ParseError("model fixture must be a JSON array of entries");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new ValidationError(`model fixture entry ${index} is not an object`);
    }
    const parsed = rawModelEntrySchema.safeParse(entry);
    if (!parsed.success) {
      throw new ValidationError(
        `model fixture entry ${index} invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
        entry,
      );
    }
    return {
      sourceItemId: parsed.data.sourceItemId,
      name: parsed.data.name,
      modelId: parsed.data.modelId ?? null,
      provider: parsed.data.provider ?? null,
      releaseDate: parsed.data.releaseDate ?? null,
      currentVersion: parsed.data.currentVersion ?? null,
      isDownloadable:
        parsed.data.isDownloadable ?? parsed.data.downloadable ?? null,
      contextWindow: parsed.data.contextWindow ?? null,
      inputPricePer1M: parsed.data.inputPricePer1M ?? null,
      outputPricePer1M: parsed.data.outputPricePer1M ?? null,
      pricingNotes: parsed.data.pricingNotes ?? null,
      modalities: parsed.data.modalities ?? [],
      websiteUrl: parsed.data.websiteUrl ?? null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      summary: parsed.data.summary ?? null,
      content: parsed.data.content ?? null,
      publishedAt: parsed.data.publishedAt ?? null,
      raw: parsed.data.raw,
    } satisfies RawModelItem;
  });
}

async function fromXml(xml: string): Promise<RawModelItem[]> {
  return (await parseRssString(xml)).map((item) => ({
    sourceItemId: item.sourceItemId,
    name: item.title ?? "",
    provider: item.author ?? null,
    websiteUrl: item.link ?? null,
    sourceUrl: item.link ?? null,
    summary: item.summary ?? null,
    content: item.content ?? null,
    publishedAt: item.publishedAt ?? null,
    raw: item.raw,
  }));
}

function parseModelItems(text: string): Promise<RawModelItem[]> {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) return fromXml(trimmed);
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (err) {
    throw new ParseError(
      `model fixture is neither XML nor valid JSON: ${(err as Error).message}`,
      err,
    );
  }
  return Promise.resolve(fromModelEntries(json));
}

export const modelFixtureAdapter: ModelSourceAdapter = {
  key: "model:fixture",
  label: "Model fixture (offline)",
  async fetchItems(ctx: ModelAdapterContext): Promise<RawModelItem[]> {
    const config = (ctx.source.config ?? {}) as Record<string, unknown>;
    const inline = config.fixtureInline;
    if (typeof inline === "string" && inline.trim().length > 0) {
      return parseModelItems(inline);
    }
    const path = config.fixturePath;
    if (typeof path === "string" && path.trim().length > 0) {
      const abs = resolve(/* turbopackIgnore: true */ process.cwd(), path);
      let text: string;
      try {
        text = await readFile(abs, "utf8");
      } catch (err) {
        throw new ParseError(
          `cannot read model fixture file ${abs}: ${(err as Error).message}`,
          err,
        );
      }
      return parseModelItems(text);
    }
    throw new ParseError(
      "model source requires config.fixtureInline or config.fixturePath",
    );
  },
};