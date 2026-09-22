import { ParseError } from "../errors";
import type {
  ModelAdapterContext,
  ModelSourceAdapter,
  RawModelItem,
} from "../models/types";

const HF_BASE = "https://huggingface.co/api/models";
const HF_SITE = "https://huggingface.co";

interface HfEntry {
  id?: string;
  _id?: string;
  modelId?: string;
  createdAt?: string;
  private?: boolean;
  disabled?: boolean;
  gated?: boolean | string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  [key: string]: unknown;
}

/** pipeline_tag -> modality tags. Covers the HF pipeline inventory. */
const PIPELINE_MODALITY: Record<string, string[]> = {
  "text-generation": ["text"],
  "text-generation-with-past": ["text"],
  "text2text-generation": ["text"],
  "text-to-text": ["text"],
  "text-classification": ["text"],
  "feature-extraction": ["text"],
  "sentence-similarity": ["text"],
  "token-classification": ["text"],
  "fill-mask": ["text"],
  "question-answering": ["text"],
  "table-question-answering": ["text"],
  "summarization": ["text"],
  "zero-shot-classification": ["text"],
  "zero-shot-image-classification": ["image"],
  "conversational": ["text"],
  "reinforcement-learning": ["text"],
  "text-to-image": ["image"],
  "text-to-image-generation": ["image"],
  "image-to-text": ["image"],
  "image-to-text-generation": ["image"],
  "image-classification": ["image"],
  "image-feature-extraction": ["image"],
  "image-segmentation": ["image"],
  "object-detection": ["image"],
  "object-detection-continental": ["image"],
  "image-to-image": ["image"],
  "image-to-image-generation": ["image"],
  "mask-generation": ["image"],
  "depth-estimation": ["image"],
  "visual-question-answering": ["image", "text"],
  "document-question-answering": ["image", "text"],
  "graph-ml": ["text"],
  "text-to-audio": ["audio"],
  "text-to-speech": ["audio"],
  "audio-to-audio": ["audio"],
  "audio-classification": ["audio"],
  "audio-to-text": ["audio"],
  "automatic-speech-recognition": ["audio"],
  "automatic-speech-recognition-continental": ["audio"],
  "speech-segmentation": ["audio"],
  "image-text-to-text": ["image", "text"],
  "image-text-to-image": ["image", "text"],
  "video-text-to-text": ["video", "text"],
  "text-to-video": ["video"],
  "any-to-any": ["text", "image", "audio"],
  "any-to-any-generation": ["text", "image", "audio"],
  "next-sentence-prediction": ["text"],
  "image-to-audio": ["image", "audio"],
  "audio-to-image": ["audio", "image"],
  "chatbot": ["text"],
  "stable-diffusion": ["image"],
  "stable-diffusion-continental": ["image"],
  "depth-to-image": ["image"],
  "translation": ["text"],
  "text-conditioned-generation": ["text"],
  "unconditional-image-generation": ["image"],
};

function modalityOf(entry: HfEntry): string[] {
  const via = PIPELINE_MODALITY[entry.pipeline_tag ?? ""];
  if (via) return [...via];
  const tags = entry.tags ?? [];
  const detected = new Set<string>();
  for (const tag of tags) {
    const lower = String(tag).toLowerCase();
    if (/audio|speech/i.test(lower)) detected.add("audio");
    else if (/video/i.test(lower)) detected.add("video");
    else if (/image|vision/i.test(lower)) detected.add("image");
    else if (/^(text|nlp|llm|language|conversation)/i.test(lower)) detected.add("text");
  }
  return [...detected];
}

function modelNameOf(id: string): string {
  const parts = id.split("/");
  const last = parts[parts.length - 1];
  return (last && last.trim().length > 0 ? last : id).trim();
}

function providerOf(id: string): string | null {
  const parts = id.split("/");
  return parts.length > 1 && parts[0].trim().length > 0 ? parts[0].trim() : null;
}

function factText(entry: HfEntry): string {
  const bits = [`Hugging Face model ${entry.id ?? ""}`];
  if (typeof entry.downloads === "number") bits.push(`${entry.downloads} downloads`);
  if (typeof entry.likes === "number") bits.push(`${entry.likes} likes`);
  if (entry.pipeline_tag) bits.push(`pipeline: ${entry.pipeline_tag}`);
  return bits.join(". ");
}

/**
 * Pure mapping from a Hugging Face model API entry to a raw model item.
 * Unavailable facts become null — never invented values. Exported for tests.
 */
export function mapHfEntry(entry: HfEntry): RawModelItem {
  const id = entry.id ?? entry._id ?? entry.modelId ?? "";
  const siteUrl = `${HF_SITE}/${id
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  return {
    sourceItemId: id,
    name: modelNameOf(id),
    modelId: id,
    provider: providerOf(id),
    releaseDate: entry.createdAt ?? null,
    isDownloadable: !entry.private && !Boolean(entry.gated),
    contextWindow: null,
    inputPricePer1M: null,
    outputPricePer1M: null,
    modalities: modalityOf(entry),
    websiteUrl: siteUrl,
    sourceUrl: siteUrl,
    summary: factText(entry),
    content: factText(entry),
    publishedAt: entry.createdAt ? new Date(entry.createdAt) : null,
    raw: entry as unknown as Record<string, unknown>,
  };
}

function isUsable(entry: HfEntry): boolean {
  const id = entry.id ?? entry._id ?? entry.modelId ?? "";
  if (!id.trim()) return false;
  if (entry.private === true) return false;
  if (entry.disabled === true) return false;
  return true;
}

function buildUrl(config: Record<string, unknown>): string {
  const base = typeof config.baseUrl === "string" && config.baseUrl.trim()
    ? config.baseUrl.trim()
    : HF_BASE;
  const params = new URLSearchParams();
  const limitRaw = Number(config.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 1000) : 50;
  params.set("limit", String(limit));
  const sort = typeof config.sort === "string" && config.sort.trim() ? config.sort.trim() : "downloads";
  params.set("sort", sort);
  const direction = typeof config.direction === "string" ? config.direction.trim() : "-1";
  params.set("direction", direction);
  const filter = typeof config.filter === "string" && config.filter.trim()
    ? config.filter.trim()
    : "";
  if (filter) params.set("filter", filter);
  return `${base}?${params.toString()}`;
}

export const hfModelAdapter: ModelSourceAdapter = {
  key: "model:huggingface",
  label: "Hugging Face Model API",
  async fetchItems(ctx: ModelAdapterContext): Promise<RawModelItem[]> {
    const config = (ctx.source.config ?? {}) as Record<string, unknown>;
    const url = buildUrl(config);
    const text = await ctx.httpGet(url);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new ParseError(`invalid JSON from Hugging Face API: ${(err as Error).message}`, err);
    }
    if (!Array.isArray(parsed)) {
      throw new ParseError("Hugging Face model API did not return a JSON array");
    }
    return parsed
      .filter((entry): entry is HfEntry => {
        const isValid =
          entry != null &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string";
        if (!isValid) return false;
        return isUsable(entry as HfEntry);
      })
      .map(mapHfEntry);
  },
};