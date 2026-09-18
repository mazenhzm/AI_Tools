import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { runModelSource } from "@/ingestion/models/pipeline";
import type { SourceRow } from "@/ingestion/models/types";
import { clearDb } from "../db/helpers";

function fixtureJson(entries: Record<string, unknown>[]): string {
  return JSON.stringify(entries);
}

function entry(name: string, overrides: Record<string, unknown> = {}) {
  return {
    sourceItemId: `src-${name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
    modelId: name.toLowerCase().replace(/\W+/g, "-"),
    provider: "Sample Provider",
    currentVersion: "1.0",
    isDownloadable: false,
    contextWindow: 1024,
    inputPricePer1M: 1,
    outputPricePer1M: 3,
    modalities: ["text"],
    websiteUrl: `https://sample.example.com/${name.toLowerCase().replace(/\W+/g, "-")}`,
    sourceUrl: `https://sample.example.com/${name.toLowerCase().replace(/\W+/g, "-")}/changelog`,
    summary: "demo",
    content: "demo body",
    raw: {},
    ...overrides,
  };
}

async function makeModelSource(
  entries: Record<string, unknown>[],
  overrides: Partial<typeof s.sources.$inferInsert> = {},
): Promise<SourceRow> {
  const [source] = await db
    .insert(s.sources)
    .values({
      name: "Model Fixture",
      slug: `model-fixture-${Math.floor(Math.random() * 1e9)}`,
      type: "manual",
      adapterKey: "model:fixture",
      config: { fixtureInline: fixtureJson(entries) },
      ...overrides,
    })
    .returning();
  return source;
}

async function countModels(): Promise<number> {
  const rows = await db.select({ id: s.models.id }).from(s.models);
  return rows.length;
}

beforeEach(async () => {
  await clearDb();
});

describe("runModelSource", () => {
  it("creates draft models from a fixture source", async () => {
    const source = await makeModelSource([entry("Alpha"), entry("Beta")]);
    const result = await runModelSource({ sourceId: source.id });

    expect(result.status).toBe("completed");
    expect(result.metrics.fetched).toBe(2);
    expect(result.metrics.created).toBe(2);
    expect(await countModels()).toBe(2);

    const model = (await db.select().from(s.models))[0];
    expect(model.status).toBe("draft");
    expect(model.slug).toBe("sample-provider-alpha");

    const anchors = await db.select().from(s.modelSources);
    expect(anchors).toHaveLength(2);
    expect(anchors.every((a) => a.sourceId === source.id)).toBe(true);
  });

  it("is idempotent across repeated runs", async () => {
    const source = await makeModelSource([entry("Alpha")]);
    await runModelSource({ sourceId: source.id });
    const second = await runModelSource({ sourceId: source.id });

    expect(second.metrics.created).toBe(0);
    expect(second.metrics.duplicates).toBe(1);
    expect(await countModels()).toBe(1);
    expect((await db.select().from(s.modelSources)).length).toBe(1);
  });

  it("matches existing models by (provider, modelIdentifier) and anchors them", async () => {
    const [provider] = await db
      .insert(s.modelProviders)
      .values({ name: "Sample Provider", slug: "sample-provider" })
      .returning();
    const [existingModel] = await db
      .insert(s.models)
      .values({
        providerId: provider.id,
        name: "Alpha",
        slug: "sample-provider-alpha",
        modelIdentifier: "alpha",
        currentVersion: "1.0",
        isDownloadable: false,
        contextWindow: 1024,
        inputPricePer1M: "1",
        outputPricePer1M: "3",
        modalities: ["text"],
        websiteUrl: "https://sample.example.com/alpha",
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    const source = await makeModelSource([entry("Alpha")]);
    const result = await runModelSource({ sourceId: source.id });

    expect(result.metrics.duplicates).toBe(1);
    expect(result.metrics.created).toBe(0);
    expect(await countModels()).toBe(1);

    const [anchor] = await db
      .select()
      .from(s.modelSources)
      .where(and(eq(s.modelSources.sourceId, source.id)));
    expect(anchor.modelId).toBe(existingModel.id);
    expect(anchor.sourceItemId).toBe("src-alpha");
  });

  it("advances facts AND records one draft update when facts change", async () => {
    const source = await makeModelSource([
      entry("Alpha", { contextWindow: 1024, currentVersion: "1.0" }),
    ]);
    await runModelSource({ sourceId: source.id });
    const [modelBefore] = await db.select().from(s.models);
    expect(modelBefore.contextWindow).toBe(1024);

    // Re-run with the same source, updated > 1.5x facts.
    await db
      .update(s.sources)
      .set({
        config: {
          fixtureInline: fixtureJson([
            entry("Alpha", { contextWindow: 4096, currentVersion: "2.0" }),
          ]),
        },
      })
      .where(eq(s.sources.id, source.id));

    const second = await runModelSource({ sourceId: source.id });
    expect(second.metrics.updated).toBe(1);

    const [modelAfter] = await db.select().from(s.models);
    expect(modelAfter.contextWindow).toBe(4096);
    expect(modelAfter.currentVersion).toBe("2.0");

    const [update] = await db
      .select()
      .from(s.modelUpdates)
      .where(eq(s.modelUpdates.modelId, modelAfter.id));
    expect(update).toBeDefined();
    expect(update.kind).toBe("context_window");
    expect(update.status).toBe("draft");
    expect(update.sourceUrl).toContain("/changelog");
    expect(update.snapshot?.changes).toHaveLength(2);
  });

  it("records only the first change per source url (history preserved)", async () => {
    const source = await makeModelSource([
      entry("Alpha", { contextWindow: 1024 }),
    ]);
    await runModelSource({ sourceId: source.id });

    await db
      .update(s.sources)
      .set({
        config: { fixtureInline: fixtureJson([entry("Alpha", { contextWindow: 2048 })]) },
      })
      .where(eq(s.sources.id, source.id));
    await runModelSource({ sourceId: source.id });

    await db
      .update(s.sources)
      .set({
        config: { fixtureInline: fixtureJson([entry("Alpha", { contextWindow: 8192 })]) },
      })
      .where(eq(s.sources.id, source.id));
    const third = await runModelSource({ sourceId: source.id });

    // The URL already has a recorded update → reported as duplicate, no new row.
    expect(third.metrics.updated).toBe(0);
    expect((await db.select().from(s.modelUpdates)).length).toBe(1);
    const [model] = await db.select().from(s.models);
    expect(model.contextWindow).toBe(2048);
  });

  it("isolates invalid items without aborting the run", async () => {
    const source = await makeModelSource([
      entry("Alpha"),
      // passes the raw schema but yields no usable name after stripping html
      { sourceItemId: "bad", name: "<br/>", provider: null },
    ]);
    const result = await runModelSource({ sourceId: source.id });

    expect(result.status).toBe("completed");
    expect(result.metrics.invalid).toBe(1);
    expect(result.metrics.created).toBe(1);
    expect(result.items.some((item) => item.outcome === "invalid")).toBe(true);
  });

  it("marks the run failed when the fixture cannot be parsed", async () => {
    const source = await makeModelSource([]);
    await db
      .update(s.sources)
      .set({ config: { fixtureInline: "not json nor xml {" } })
      .where(eq(s.sources.id, source.id));
    const result = await runModelSource({ sourceId: source.id });

    expect(result.status).toBe("failed");
    expect(result.metrics.fetched).toBe(0);
  });
});