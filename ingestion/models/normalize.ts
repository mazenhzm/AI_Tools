import { normalizedModelSchema, type NormalizedModel } from "@/lib/validation/models";
import { contentHash } from "@/lib/utils/hash";
import { normalizeUrl } from "@/lib/utils/url";
import { slugify, stripHtml, truncate } from "@/lib/utils/text";
import { ValidationError } from "../errors";
import type { RawModelItem } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseReleaseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = String(value).trim();
  if (ISO_DATE.test(candidate)) return candidate;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parsePrice(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return String(value);
}

/**
 * Converts an adapter model entry into a validated normalized model.
 * Unknown facts become `null`/`[]` — never invented values.
 * Throws ValidationError when a required field (name) is missing.
 */
export function normalizeModelItem(raw: RawModelItem): NormalizedModel {
  const name = stripHtml(raw.name)?.trim() || "";
  if (name.length < 2) {
    throw new ValidationError("model item has no usable name", raw.raw);
  }
  const providerName = raw.provider?.trim() || null;
  const slug = slugify(providerName ? `${providerName} ${name}` : name);
  if (!slug) {
    throw new ValidationError(`cannot derive slug from model name "${name}"`, raw.raw);
  }

  const modelIdentifier = raw.modelId?.trim() || null;
  const websiteUrl = raw.websiteUrl ? normalizeUrl(raw.websiteUrl) : null;
  const sourceUrl = raw.sourceUrl ? normalizeUrl(raw.sourceUrl) : null;
  const modalities = Array.isArray(raw.modalities)
    ? [
        ...new Set(
          raw.modalities
            .map((m) => String(m).trim().toLowerCase())
            .filter((m) => m.length > 0),
        ),
      ]
    : [];
  const isDownloadable = Boolean(raw.isDownloadable ?? raw.raw.downloadable);

  const built: NormalizedModel = {
    sourceItemId: raw.sourceItemId,
    name: truncate(name, 200),
    slug,
    modelIdentifier,
    providerName,
    releaseDate: parseReleaseDate(raw.releaseDate ?? null),
    currentVersion: raw.currentVersion?.trim() || null,
    isDownloadable,
    contextWindow: raw.contextWindow ?? null,
    inputPricePer1M: parsePrice(raw.inputPricePer1M),
    outputPricePer1M: parsePrice(raw.outputPricePer1M),
    pricingNotes: raw.pricingNotes?.trim() || null,
    modalities,
    websiteUrl,
    sourceUrl,
    contentText: truncate(stripHtml(raw.content ?? raw.summary ?? raw.name) || "", 20000),
    publishedAt: raw.publishedAt ?? null,
    contentHash: contentHash([
      truncate(name, 200),
      providerName,
      modelIdentifier,
      parseReleaseDate(raw.releaseDate ?? null),
      raw.currentVersion?.trim() ?? null,
      String(isDownloadable),
      String(raw.contextWindow ?? ""),
      String(raw.inputPricePer1M ?? ""),
      String(raw.outputPricePer1M ?? ""),
      raw.pricingNotes?.trim() ?? null,
      modalities.join(","),
      websiteUrl,
    ]),
  };

  const parsed = normalizedModelSchema.safeParse(built);
  if (!parsed.success) {
    throw new ValidationError(
      `normalized model failed validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
      built,
    );
  }
  return parsed.data;
}