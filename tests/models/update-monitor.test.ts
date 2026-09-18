import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import {
  describeModelChanges,
  detectModelChanges,
  dominantKind,
  recordModelUpdate,
} from "@/ingestion/models/update-monitor";
import { normalizeModelItem } from "@/ingestion/models/normalize";
import type { RawModelItem } from "@/ingestion/models/types";
import { clearDb } from "../db/helpers";

function rawFactual(overrides: Partial<RawModelItem> = {}): RawModelItem {
  return {
    sourceItemId: "entry-1",
    name: "Alpha Chat",
    modelId: "alpha-chat",
    provider: "Acme AI",
    releaseDate: "2026-01-02",
    currentVersion: "1.0",
    isDownloadable: false,
    contextWindow: 128000,
    inputPricePer1M: 1,
    outputPricePer1M: 5,
    pricingNotes: null,
    modalities: ["text"],
    websiteUrl: "https://acme.example.com/alpha",
    sourceUrl: "https://acme.example.com/alpha/changelog",
    summary: "hello",
    content: null,
    publishedAt: null,
    raw: {},
    ...overrides,
  };
}

async function seedModel(
  overrides: Partial<typeof s.models.$inferInsert> = {},
): Promise<typeof s.models.$inferSelect> {
  const [row] = await db
    .insert(s.models)
    .values({
      name: "Alpha Chat",
      slug: "acme-ai-alpha-chat",
      modelIdentifier: "alpha-chat",
      releaseDate: "2026-01-02",
      currentVersion: "1.0",
      isDownloadable: false,
      contextWindow: 128000,
      inputPricePer1M: "1.00",
      outputPricePer1M: "5.00",
      pricingNotes: null,
      modalities: ["text"],
      websiteUrl: "https://acme.example.com/alpha",
      ...overrides,
    })
    .returning();
  return row;
}

beforeEach(async () => {
  await clearDb();
});

describe("detectModelChanges", () => {
  it("returns no changes when facts are equal", async () => {
    const model = await seedModel();
    const next = normalizeModelItem(rawFactual());
    expect(detectModelChanges(model, next)).toEqual([]);
  });

  it("detects a context window change and labels it", async () => {
    const model = await seedModel();
    const next = normalizeModelItem(rawFactual({ contextWindow: 1000000 }));
    const changes = detectModelChanges(model, next);
    expect(changes.some((c) => c.field === "contextWindow")).toBe(true);
    expect(changes[0].kind).toBe("context_window");
  });

  it("ignores free-text-only differences (summary/content)", async () => {
    const model = await seedModel();
    const next = normalizeModelItem(rawFactual({ summary: "totally different" }));
    expect(detectModelChanges(model, next)).toEqual([]);
  });

  it("ignores description-only differences on the model row", async () => {
    const model = await seedModel({ descriptionAr: "صف سابق" });
    const next = normalizeModelItem(rawFactual());
    expect(detectModelChanges(model, next)).toEqual([]);
  });

  it("orders pricing higher than availability than metadata", () => {
    const kinds = [
      dominantKind([
        { field: "x", labelAr: "x", before: 1, after: 2, kind: "metadata" },
      ]),
      dominantKind([
        { field: "y", labelAr: "y", before: 1, after: 2, kind: "availability" },
        { field: "z", labelAr: "z", before: 1, after: 2, kind: "pricing" },
      ]),
      dominantKind([
        { field: "a", labelAr: "a", before: 1, after: 2, kind: "context_window" },
        { field: "b", labelAr: "b", before: 1, after: 2, kind: "new_version" },
      ]),
    ];
    expect(kinds).toEqual(["metadata", "pricing", "context_window"]);
  });
});

describe("describeModelChanges", () => {
  it("renders Arabic change lines with before→after", async () => {
    const model = await seedModel();
    const next = normalizeModelItem(rawFactual({ contextWindow: 1000000 }));
    const text = describeModelChanges(detectModelChanges(model, next));
    expect(text).toContain("نافذة السياق");
    expect(text).toContain("→");
  });
});

describe("recordModelUpdate", () => {
  it("skips when there are no changes or no source url", async () => {
    const model = await seedModel();
    await expect(
      recordModelUpdate(db, {
        modelId: model.id,
        changes: [],
        kind: "metadata",
        contentAr: "",
        sourceUrl: "https://x.example.com",
        publishedAt: null,
      }),
    ).resolves.toBe("skipped");
  });

  it("records a draft update keyed by source url and is idempotent", async () => {
    const model = await seedModel();
    const changes = detectModelChanges(
      model,
      normalizeModelItem(rawFactual({ contextWindow: 1000000 })),
    );
    const input = {
      modelId: model.id,
      changes,
      kind: dominantKind(changes),
      contentAr: describeModelChanges(changes),
      sourceUrl: "https://acme.example.com/alpha/changelog",
      publishedAt: new Date("2026-02-01T00:00:00Z"),
    };

    await expect(recordModelUpdate(db, input)).resolves.toBe("created");
    const [update] = await db
      .select()
      .from(s.modelUpdates)
      .where(eq(s.modelUpdates.modelId, model.id))
      .limit(1);
    expect(update.status).toBe("draft");
    expect(update.kind).toBe("context_window");
    expect(update.title.length).toBeGreaterThan(0);
    expect(update.sourceUrl).toBe(input.sourceUrl);
    expect(update.snapshot?.changes).toHaveLength(changes.length);

    await expect(recordModelUpdate(db, input)).resolves.toBe("exists");
    const updates = await db.select().from(s.modelUpdates);
    expect(updates).toHaveLength(1);

    const otherUrl = await recordModelUpdate(db, {
      ...input,
      sourceUrl: "https://acme.example.com/alpha/other",
    });
    expect(otherUrl).toBe("created");
    expect((await db.select().from(s.modelUpdates)).length).toBe(2);
  });

  it("stores fairness: unknown values are recorded as null, never invented", async () => {
    const model = await seedModel();
    const changes = detectModelChanges(
      model,
      normalizeModelItem(rawFactual({ inputPricePer1M: null })),
    );
    const change = changes.find((c) => c.field === "inputPricePer1M");
    expect(change?.after).toBeNull();
  });
});