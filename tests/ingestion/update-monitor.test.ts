import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { runSource } from "@/ingestion/pipeline";
import { recordToolUpdate } from "@/ingestion/update-monitor";
import type { SourceRow } from "@/ingestion/types";
import { clearDb } from "../db/helpers";

async function makeSource(
  overrides: Partial<typeof s.sources.$inferInsert> = {},
): Promise<SourceRow> {
  const [source] = await db
    .insert(s.sources)
    .values({
      name: "Update Source",
      slug: "update-source",
      type: "manual",
      adapterKey: "fixture:inline",
      config: { fixturePath: "tests/fixtures/rss/update-v1.xml" },
      ...overrides,
    })
    .returning();
  return source;
}

async function pointSourceAt(source: SourceRow, fixturePath: string) {
  await db
    .update(s.sources)
    .set({ config: { fixturePath } })
    .where(eq(s.sources.id, source.id));
}

beforeEach(async () => {
  await clearDb();
});

describe("recordToolUpdate", () => {
  async function seedTool() {
    const [tool] = await db
      .insert(s.tools)
      .values({ name: "Acme Writer", slug: "acme-writer" })
      .returning();
    return tool;
  }

  it("creates a draft update and bumps the tool timestamp", async () => {
    const tool = await seedTool();
    const before = tool.updatedAt;

    const outcome = await recordToolUpdate(db, {
      toolId: tool.id,
      title: "Acme Writer 2.0",
      contentAr: "وصف محدّث",
      sourceUrl: "https://acme-writer.example.com/",
      publishedAt: new Date("2026-09-10T09:00:00Z"),
    });
    expect(outcome).toBe("created");

    const [row] = await db
      .select()
      .from(s.updates)
      .where(eq(s.updates.toolId, tool.id));
    expect(row.title).toBe("Acme Writer 2.0");
    expect(row.contentAr).toBe("وصف محدّث");
    expect(row.sourceUrl).toBe("https://acme-writer.example.com/");
    expect(row.status).toBe("draft");

    const [after] = await db
      .select({ updatedAt: s.tools.updatedAt })
      .from(s.tools)
      .where(eq(s.tools.id, tool.id));
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("is idempotent per source url", async () => {
    const tool = await seedTool();
    const input = {
      toolId: tool.id,
      title: "Acme Writer 2.0",
      contentAr: "وصف محدّث",
      sourceUrl: "https://acme-writer.example.com/",
      publishedAt: null,
    };
    expect(await recordToolUpdate(db, input)).toBe("created");
    expect(await recordToolUpdate(db, input)).toBe("exists");

    const rows = await db.select().from(s.updates);
    expect(rows).toHaveLength(1);
  });

  it("skips updates without a source url or any content", async () => {
    const tool = await seedTool();
    expect(
      await recordToolUpdate(db, {
        toolId: tool.id,
        title: "No URL",
        contentAr: "نص",
        sourceUrl: null,
        publishedAt: null,
      }),
    ).toBe("skipped");
    expect(
      await recordToolUpdate(db, {
        toolId: tool.id,
        title: null,
        contentAr: "   ",
        sourceUrl: "https://acme-writer.example.com/",
        publishedAt: null,
      }),
    ).toBe("skipped");
    expect(await db.select().from(s.updates)).toHaveLength(0);
  });
});

describe("update monitoring in the pipeline", () => {
  it("records an update when a known source item changes", async () => {
    const source = await makeSource();
    const first = await runSource({ sourceId: source.id });
    expect(first.metrics.created).toBe(1);

    await pointSourceAt(source, "tests/fixtures/rss/update-v2.xml");
    const second = await runSource({ sourceId: source.id });

    expect(second.metrics.created).toBe(0);
    expect(second.metrics.duplicates).toBe(0);
    expect(second.metrics.updated).toBe(1);
    expect(second.items[0].outcome).toBe("updated");

    const [update] = await db.select().from(s.updates);
    expect(update.sourceUrl).toBe("https://acme-writer.example.com/");
    expect(update.contentAr).toContain("Arabic");

    const [anchor] = await db.select().from(s.toolSources);
    const [tool] = await db.select().from(s.tools);
    expect(anchor.contentHash).toBeTruthy();
    expect(anchor.toolId).toBe(tool.id);

    const [item] = await db
      .select()
      .from(s.ingestionItems)
      .where(eq(s.ingestionItems.runId, second.runId));
    expect(item.status).toBe("updated");
  });

  it("does not duplicate the update when the same change is seen again", async () => {
    const source = await makeSource();
    await runSource({ sourceId: source.id });
    await pointSourceAt(source, "tests/fixtures/rss/update-v2.xml");
    await runSource({ sourceId: source.id });

    const third = await runSource({ sourceId: source.id });
    expect(third.metrics.updated).toBe(0);
    expect(third.metrics.duplicates).toBe(1);
    expect(await db.select().from(s.updates)).toHaveLength(1);
  });

  it("treats unchanged content as a plain duplicate", async () => {
    const source = await makeSource();
    await runSource({ sourceId: source.id });
    const second = await runSource({ sourceId: source.id });

    expect(second.metrics.duplicates).toBe(1);
    expect(second.metrics.updated).toBe(0);
    expect(await db.select().from(s.updates)).toHaveLength(0);
  });

  it("establishes a content-hash baseline without recording an update", async () => {
    const source = await makeSource();
    await runSource({ sourceId: source.id });
    await db.update(s.toolSources).set({ contentHash: null });

    const second = await runSource({ sourceId: source.id });
    expect(second.metrics.updated).toBe(0);
    expect(await db.select().from(s.updates)).toHaveLength(0);

    const [anchor] = await db.select().from(s.toolSources);
    expect(anchor.contentHash).toBeTruthy();
  });
});
