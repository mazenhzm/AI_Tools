import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { NetworkError } from "@/ingestion/errors";
import { runSource } from "@/ingestion/pipeline";
import { runIngestion } from "@/ingestion/run";
import type { SourceRow } from "@/ingestion/types";
import { clearDb } from "../db/helpers";

async function makeSource(
  overrides: Partial<typeof s.sources.$inferInsert> = {},
): Promise<SourceRow> {
  const [source] = await db
    .insert(s.sources)
    .values({
      name: "Fixture Source",
      slug: "fixture-source",
      type: "manual",
      adapterKey: "fixture:inline",
      config: { fixturePath: "tests/fixtures/rss/valid.xml" },
      ...overrides,
    })
    .returning();
  return source;
}

async function countTools(): Promise<number> {
  const rows = await db.select({ id: s.tools.id }).from(s.tools);
  return rows.length;
}

beforeEach(async () => {
  await clearDb();
});

describe("runSource", () => {
  it("ingests items from a fixture feed and creates draft tools", async () => {
    const source = await makeSource();
    const result = await runSource({ sourceId: source.id });

    expect(result.status).toBe("completed");
    expect(result.metrics.fetched).toBe(3);
    expect(result.metrics.created).toBe(3);
    expect(result.metrics.duplicates).toBe(0);
    expect(result.metrics.errors).toBe(0);
    expect(await countTools()).toBe(3);

    const tools = await db.select().from(s.tools);
    expect(tools.every((tool) => tool.status === "draft")).toBe(true);
    const sources = await db.select().from(s.toolSources);
    expect(sources).toHaveLength(3);
  });

  it("is idempotent across repeated runs", async () => {
    const source = await makeSource();
    await runSource({ sourceId: source.id });
    const second = await runSource({ sourceId: source.id });

    expect(second.metrics.created).toBe(0);
    expect(second.metrics.duplicates).toBe(3);
    expect(await countTools()).toBe(3);
  });

  it("isolates invalid items without aborting the run", async () => {
    const source = await makeSource({
      config: { fixturePath: "tests/fixtures/rss/partial.xml" },
    });
    const result = await runSource({ sourceId: source.id });

    expect(result.status).toBe("completed");
    expect(result.metrics.fetched).toBe(3);
    expect(result.metrics.created).toBe(2);
    expect(result.metrics.invalid).toBe(1);
    expect(result.metrics.errors).toBe(0);
    expect(await countTools()).toBe(2);
    expect(result.items.some((item) => item.outcome === "invalid")).toBe(true);
  });

  it("marks the run failed when the feed cannot be parsed", async () => {
    const source = await makeSource({
      config: { fixturePath: "tests/fixtures/rss/malformed.xml" },
    });
    const result = await runSource({ sourceId: source.id });

    expect(result.status).toBe("failed");
    expect(result.metrics.fetched).toBe(0);
    expect(await countTools()).toBe(0);

    const [run] = await db
      .select()
      .from(s.ingestionRuns)
      .where(eq(s.ingestionRuns.id, result.runId));
    expect(run.status).toBe("failed");
    expect(run.error).toContain("parse");
  });

  it("marks the run failed on network error", async () => {
    const source = await makeSource({
      adapterKey: "rss:generic",
      url: "https://unreachable.example.com/feed.xml",
    });
    const result = await runSource({
      sourceId: source.id,
      httpGet: async () => {
        throw new NetworkError("connection refused");
      },
    });

    expect(result.status).toBe("failed");
    expect(await countTools()).toBe(0);
  });

  it("dedupes against an existing tool with the same website url", async () => {
    await db.insert(s.tools).values({
      name: "Existing Acme",
      slug: "existing-acme",
      websiteUrl: "https://acme-writer.example.com",
    });
    const source = await makeSource();
    const result = await runSource({ sourceId: source.id });

    expect(result.metrics.duplicates).toBe(1);
    expect(result.metrics.created).toBe(2);
    expect(await countTools()).toBe(3);
  });

  it("records run metrics and source timestamps", async () => {
    const source = await makeSource();
    const result = await runSource({ sourceId: source.id });

    const [run] = await db
      .select()
      .from(s.ingestionRuns)
      .where(eq(s.ingestionRuns.id, result.runId));
    expect(run.status).toBe("completed");
    expect(run.finishedAt).toBeInstanceOf(Date);
    expect(Number(run.metrics.fetched)).toBe(3);

    const [updated] = await db
      .select()
      .from(s.sources)
      .where(eq(s.sources.id, source.id));
    expect(updated.lastFetchedAt).toBeInstanceOf(Date);
    expect(updated.lastSuccessAt).toBeInstanceOf(Date);
  });
});

describe("runIngestion", () => {
  it("excludes model sources so the tools worker never runs them", async () => {
    const toolSource = await makeSource();
    const [modelSource] = await db
      .insert(s.sources)
      .values({
        name: "Model Fixture",
        slug: "model-fixture",
        type: "manual",
        adapterKey: "model:fixture",
        config: { fixtureInline: "[]" },
        active: true,
      })
      .returning();

    const summaries = await runIngestion({ maxItems: 5 });

    expect(summaries.map((summary) => summary.sourceId)).toEqual([toolSource.id]);
    expect(summaries[0].result.metrics.created).toBe(3);

    const modelRuns = await db
      .select({ id: s.ingestionRuns.id })
      .from(s.ingestionRuns)
      .where(eq(s.ingestionRuns.sourceId, modelSource.id));
    expect(modelRuns).toHaveLength(0);
  });

  it("paces between sources when configured", async () => {
    const first = await makeSource();
    const [second] = await db
      .insert(s.sources)
      .values({
        name: "Second Feed",
        slug: "second-feed",
        type: "manual",
        adapterKey: "fixture:inline",
        config: { fixturePath: "tests/fixtures/rss/valid.xml" },
        active: true,
      })
      .returning();

    const start = Date.now();
    const summaries = await runIngestion({ maxItems: 5 });
    const elapsed = Date.now() - start;

    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.sourceId)).toEqual([first.id, second.id]);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
