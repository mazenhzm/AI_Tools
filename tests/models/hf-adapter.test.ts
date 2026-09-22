import { describe, expect, it } from "vitest";
import { mapHfEntry } from "@/ingestion/adapters/hf-models";
import { ParseError } from "@/ingestion/errors";

function hfEntry(overrides: Record<string, unknown> = {}) {
  return {
    _id: "621ffdc136468d709f180294",
    id: "sentence-transformers/all-MiniLM-L6-v2",
    modelId: "sentence-transformers/all-MiniLM-L6-v2",
    likes: 6102,
    private: false,
    downloads: 251974790,
    tags: ["sentence-transformers", "pytorch", "bert", "feature-extraction"],
    pipeline_tag: "sentence-similarity",
    library_name: "sentence-transformers",
    createdAt: "2022-03-02T23:29:05.000Z",
    ...overrides,
  };
}

describe("mapHfEntry", () => {
  it("maps a public entry to raw model fields", () => {
    const item = mapHfEntry(hfEntry());
    expect(item.sourceItemId).toBe("sentence-transformers/all-MiniLM-L6-v2");
    expect(item.name).toBe("all-MiniLM-L6-v2");
    expect(item.modelId).toBe("sentence-transformers/all-MiniLM-L6-v2");
    expect(item.provider).toBe("sentence-transformers");
    expect(item.isDownloadable).toBe(true);
    expect(item.publishedAt).toEqual(new Date("2022-03-02T23:29:05.000Z"));
    expect(item.releaseDate).toBe("2022-03-02T23:29:05.000Z");
    expect(item.websiteUrl).toBe(
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2",
    );
    expect(item.sourceUrl).toBe(item.websiteUrl);
    expect(item.inputPricePer1M).toBeNull();
    expect(item.outputPricePer1M).toBeNull();
    expect(item.contextWindow).toBeNull();
    expect(item.summary).toContain("251974790 downloads");
    expect(item.raw.id).toBe("sentence-transformers/all-MiniLM-L6-v2");
  });

  it("derives text modality from pipeline tag", () => {
    expect(mapHfEntry(hfEntry({ pipeline_tag: "text-generation" })).modalities).toEqual([
      "text",
    ]);
  });

  it("derives image+text modality for vision-language pipelines", () => {
    expect(mapHfEntry(hfEntry({ pipeline_tag: "image-text-to-text" })).modalities).toEqual([
      "image",
      "text",
    ]);
  });

  it("derives audio modality for speech pipelines", () => {
    expect(mapHfEntry(hfEntry({ pipeline_tag: "text-to-speech" })).modalities).toEqual([
      "audio",
    ]);
  });

  it("falls back to audio/video/text detection over tags for unknown pipelines", () => {
    const item = mapHfEntry(
      hfEntry({
        pipeline_tag: "whatever-custom",
        tags: ["text-to-audio", "automatic-speech-recognition"],
      }),
    );
    expect(item.modalities).toEqual(["audio"]);
  });

  it("marks gated and private models as not downloadable", () => {
    expect(mapHfEntry(hfEntry({ gated: true })).isDownloadable).toBe(false);
    expect(mapHfEntry(hfEntry({ gated: "auto" })).isDownloadable).toBe(false);
    expect(mapHfEntry(hfEntry({ private: true })).isDownloadable).toBe(false);
  });

  it("treats entries without a createdAt as having no published date", () => {
    const item = mapHfEntry(hfEntry({ createdAt: undefined }));
    expect(item.publishedAt).toBeNull();
    expect(item.releaseDate).toBeNull();
  });

  it("uses the full id when name and provider are not distinguishable", () => {
    const item = mapHfEntry(hfEntry({ id: "gpt2", modelId: "gpt2" }));
    expect(item.name).toBe("gpt2");
    expect(item.provider).toBeNull();
  });
});

describe("hfModelAdapter", () => {
  it("throws ParseError when the API body is not a JSON array", async () => {
    const { hfModelAdapter } = await import("@/ingestion/adapters/hf-models");
    await expect(
      hfModelAdapter.fetchItems({
        source: {
          config: {},
          url: "https://huggingface.co/api/models",
        } as never,
        httpGet: async () => '{"error":"bad"}',
        timeoutMs: 5000,
      }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("filters private/disabled and non-object entries out of the response", async () => {
    const { hfModelAdapter } = await import("@/ingestion/adapters/hf-models");
    const body = JSON.stringify([
      hfEntry(),
      hfEntry({ id: "org/private-model", private: true }),
      hfEntry({ id: "org/disabled-model", disabled: true }),
      { not: "an entry" },
    ]);
    const items = await hfModelAdapter.fetchItems({
      source: { config: {}, url: "https://huggingface.co/api/models" } as never,
      httpGet: async () => body,
      timeoutMs: 5000,
    });
    expect(items).toHaveLength(1);
    expect(items[0].sourceItemId).toBe("sentence-transformers/all-MiniLM-L6-v2");
  });
});