import { z } from "zod";

/**
 * Raw model entry exactly as provided by a model source adapter. Every field is
 * optional here; unknown values must become NULL during normalization, never an
 * invented value.
 */
export const rawModelEntrySchema = z.object({
  sourceItemId: z.string().min(1),
  name: z.string().min(1),
  modelId: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
  currentVersion: z.string().optional().nullable(),
  isDownloadable: z.boolean().optional().nullable(),
  downloadable: z.boolean().optional().nullable(),
  contextWindow: z.number().int().positive().optional().nullable(),
  inputPricePer1M: z.number().positive().optional().nullable(),
  outputPricePer1M: z.number().positive().optional().nullable(),
  pricingNotes: z.string().optional().nullable(),
  modalities: z.array(z.string()).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  summary: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  publishedAt: z.date().optional().nullable(),
  raw: z.record(z.string(), z.unknown()).default({}),
});

export type RawModelEntryInput = z.infer<typeof rawModelEntrySchema>;

/** Factual field names hashed for change detection (not the free text). */
export const MODEL_FACT_FIELDS = [
  "name",
  "providerName",
  "modelIdentifier",
  "releaseDate",
  "currentVersion",
  "isDownloadable",
  "contextWindow",
  "inputPricePer1M",
  "outputPricePer1M",
  "pricingNotes",
  "modalities",
  "websiteUrl",
] as const;

export const normalizedModelSchema = z.object({
  sourceItemId: z.string().min(1),
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(
      /^[\p{L}\p{N}-]+$/u,
      "slug must contain only letters, numbers and dashes",
    ),
  modelIdentifier: z.string().nullable(),
  providerName: z.string().nullable(),
  releaseDate: z.string().nullable(),
  currentVersion: z.string().nullable(),
  isDownloadable: z.boolean(),
  contextWindow: z.number().int().positive().nullable(),
  inputPricePer1M: z.string().nullable(),
  outputPricePer1M: z.string().nullable(),
  pricingNotes: z.string().nullable(),
  modalities: z.array(z.string()),
  websiteUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  contentText: z.string().max(20000),
  publishedAt: z.date().nullable(),
  contentHash: z.string().min(8),
});

export type NormalizedModel = z.infer<typeof normalizedModelSchema>;