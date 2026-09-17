import { normalizedItemSchema } from "@/lib/validation/ingestion";
import { contentHash } from "@/lib/utils/hash";
import { normalizeName, slugify, stripHtml, truncate } from "@/lib/utils/text";
import { extractDomain, normalizeUrl } from "@/lib/utils/url";
import { ValidationError } from "./errors";
import type { NormalizedItem, RawSourceItem } from "./types";

export interface NormalizeOptions {
  /** Fallback category slug applied when the source does not provide one. */
  defaultCategorySlug?: string | null;
}

function pickName(raw: RawSourceItem): string | null {
  const candidates = [raw.title, raw.summary];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length >= 2) {
      return stripHtml(candidate);
    }
  }
  return null;
}

function pickUrl(raw: RawSourceItem): string | null {
  const candidates = [raw.link];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = normalizeUrl(candidate);
      if (normalized) return normalized;
    }
  }
  return null;
}

function pickSummary(raw: RawSourceItem): string | null {
  const source = raw.summary ?? raw.content;
  if (typeof source !== "string") return null;
  const text = stripHtml(source);
  return text.length > 0 ? truncate(text, 2000) : null;
}

function pickContent(raw: RawSourceItem): string {
  const source = raw.content ?? raw.summary ?? raw.title ?? "";
  return typeof source === "string" ? stripHtml(source) : "";
}

/**
 * Converts a raw adapter item into a validated normalized item.
 * Throws ValidationError when a required field (name) cannot be derived or the
 * normalized shape is invalid — the caller records the failure and continues.
 */
export function normalizeItem(
  raw: RawSourceItem,
  options: NormalizeOptions = {},
): NormalizedItem {
  const name = pickName(raw);
  if (!name || name.length < 2) {
    throw new ValidationError("item has no usable name/title", raw);
  }

  const websiteUrl = pickUrl(raw);
  const summary = pickSummary(raw);
  const contentText = pickContent(raw);
  const slug = slugify(name);

  if (!slug) {
    throw new ValidationError(`cannot derive slug from name "${name}"`, raw);
  }

  const candidate = {
    sourceItemId: raw.sourceItemId,
    name: truncate(name, 200),
    slug,
    websiteUrl,
    domain: websiteUrl ? extractDomain(websiteUrl) : null,
    summary,
    contentText: truncate(contentText, 20000),
    publishedAt: raw.publishedAt,
    normalizedName: normalizeName(name),
    contentHash: contentHash([name, websiteUrl, summary, contentText]),
    categorySlug: options.defaultCategorySlug ?? null,
  };

  const parsed = normalizedItemSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ValidationError(
      `normalized item failed validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
      candidate,
    );
  }

  return parsed.data;
}
