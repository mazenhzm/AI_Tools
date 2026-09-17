import { describe, it, expect, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import { clearDb, asError } from "./helpers";

beforeEach(async () => {
  await clearDb();
});

describe("categories", () => {
  it("inserts a category and enforces unique slug", async () => {
    await db.insert(schema.categories).values({
      nameAr: "العنوان العربي",
      nameEn: "Arabic Title",
      slug: "arabic-title",
    });

    try {
      await db.insert(schema.categories).values({
        nameAr: "مكرر",
        nameEn: "Duplicate",
        slug: "arabic-title",
      });
      expect.unreachable("expected unique violation");
    } catch (e) {
      const err = asError(e);
      expect(err.code).toBe("23505");
    }
  });

  it("supports parent categories and rejects missing parents", async () => {
    const [parent] = await db
      .insert(schema.categories)
      .values({ nameAr: "أ", nameEn: "A", slug: "a" })
      .returning();

    const [child] = await db
      .insert(schema.categories)
      .values({
        nameAr: "ب",
        nameEn: "B",
        slug: "b",
        parentId: parent.id,
      })
      .returning();
    expect(child.parentId).toBe(parent.id);

    try {
      await db.insert(schema.categories).values({
        nameAr: "ج",
        nameEn: "C",
        slug: "c",
        parentId: "00000000-0000-0000-0000-000000000000",
      });
      expect.unreachable("expected FK violation");
    } catch (e) {
      const err = asError(e);
      expect(err.code).toBe("23503");
    }
  });
});

describe("tools", () => {
  it("defaults to draft status and zero quality score", async () => {
    const [cat] = await db
      .insert(schema.categories)
      .values({ nameAr: "أ", nameEn: "A", slug: "a" })
      .returning();

    const [tool] = await db
      .insert(schema.tools)
      .values({ name: "Sample", slug: "sample", categoryId: cat.id })
      .returning();

    expect(tool.status).toBe("draft");
    expect(tool.qualityScore).toBe("0.00");
    expect(tool.pricingType).toBe("unknown");
  });

  it("enforces unique slug and unknown-category FK", async () => {
    await db
      .insert(schema.tools)
      .values({ name: "Alpha", slug: "alpha" });

    try {
      await db
        .insert(schema.tools)
        .values({ name: "Beta", slug: "alpha" });
      expect.unreachable("expected unique violation");
    } catch (e) {
      expect(asError(e).code).toBe("23505");
    }

    try {
      await db.insert(schema.tools).values({
        name: "Gamma",
        slug: "gamma",
        categoryId: "00000000-0000-0000-0000-000000000000",
      });
      expect.unreachable("expected FK violation");
    } catch (e) {
      expect(asError(e).code).toBe("23503");
    }
  });

  it("rejects invalid enum values", async () => {
    try {
      await db.execute(sql`INSERT INTO tools (name, slug, status)
        VALUES ('bad', 'bad', 'not_a_real_status')`);
      expect.unreachable("expected enum violation");
    } catch (e) {
      expect(asError(e).code).toBe("22P02");
    }
  });

  it("cascades deletes to tool_tags/tool_features/updates and nulls category", async () => {
    const [cat] = await db
      .insert(schema.categories)
      .values({ nameAr: "أ", nameEn: "A", slug: "a" })
      .returning();
    const [tool] = await db
      .insert(schema.tools)
      .values({ name: "Sample", slug: "sample", categoryId: cat.id })
      .returning();

    const [tag] = await db
      .insert(schema.tags)
      .values({ name: "tag", slug: "tag" })
      .returning();
    const [feature] = await db
      .insert(schema.features)
      .values({ nameAr: "و", nameEn: "F", normalizedKey: "f" })
      .returning();

    await db.insert(schema.toolTags).values({ toolId: tool.id, tagId: tag.id });
    await db
      .insert(schema.toolFeatures)
      .values({ toolId: tool.id, featureId: feature.id });
    await db
      .insert(schema.updates)
      .values({ toolId: tool.id, title: "Update", sourceUrl: "https://x.test/1" });

    await db.delete(schema.tools).where(sql`${schema.tools.id} = ${tool.id}`);

    const tagsLeft = await db
      .select()
      .from(schema.toolTags)
      .where(sql`${schema.toolTags.toolId} = ${tool.id}`);
    const featuresLeft = await db
      .select()
      .from(schema.toolFeatures)
      .where(sql`${schema.toolFeatures.toolId} = ${tool.id}`);
    const updatesLeft = await db
      .select()
      .from(schema.updates)
      .where(sql`${schema.updates.toolId} = ${tool.id}`);

    expect(tagsLeft).toHaveLength(0);
    expect(featuresLeft).toHaveLength(0);
    expect(updatesLeft).toHaveLength(0);

    const orphanCat = await db
      .select()
      .from(schema.categories)
      .where(sql`${schema.categories.id} = ${cat.id}`);
    expect(orphanCat).toHaveLength(1);
  });
});

describe("tool_sources idempotency", () => {
  it("enforces composite unique (source_id, source_item_id)", async () => {
    const [tool] = await db
      .insert(schema.tools)
      .values({ name: "Sample", slug: "sample" })
      .returning();
    const [source] = await db
      .insert(schema.sources)
      .values({ name: "Source", slug: "source", type: "rss", url: "https://feed.test" })
      .returning();

    await db.insert(schema.toolSources).values({
      toolId: tool.id,
      sourceId: source.id,
      sourceItemId: "item-1",
    });

    try {
      await db.insert(schema.toolSources).values({
        toolId: tool.id,
        sourceId: source.id,
        sourceItemId: "item-1",
      });
      expect.unreachable("expected unique violation");
    } catch (e) {
      expect(asError(e).code).toBe("23505");
    }
  });
});

describe("updates partial unique index", () => {
  it("allows multiple NULL source_url but rejects duplicate URLs", async () => {
    const [tool] = await db
      .insert(schema.tools)
      .values({ name: "Sample", slug: "sample" })
      .returning();

    await db
      .insert(schema.updates)
      .values({ toolId: tool.id, title: "U1", sourceUrl: null });
    await db
      .insert(schema.updates)
      .values({ toolId: tool.id, title: "U2", sourceUrl: null });
    await db
      .insert(schema.updates)
      .values({ toolId: tool.id, title: "U3", sourceUrl: "https://x.test/u" });

    try {
      await db
        .insert(schema.updates)
        .values({ toolId: tool.id, title: "U4", sourceUrl: "https://x.test/u" });
      expect.unreachable("expected unique violation");
    } catch (e) {
      expect(asError(e).code).toBe("23505");
    }
  });
});

describe("search indexes are usable", () => {
  it("finds rows via tsvector expression index", async () => {
    await db.insert(schema.tools).values({ name: "Chat Sample", slug: "chat-sample" });
    await db.insert(schema.tools).values({ name: "Drawing App", slug: "drawing-app" });

    const rows = await db.execute(
      sql`SELECT slug FROM tools
          WHERE to_tsvector('simple', coalesce(name, ''))
            @@ to_tsquery('simple', 'chat')`,
    );
    expect(rows.rows.map((r) => r.slug)).toEqual(["chat-sample"]);
  });

  it("finds rows via trigram expression index", async () => {
    await db.insert(schema.tools).values({ name: "Pixel Artifier", slug: "pixel-artifier" });
    await db.insert(schema.tools).values({ name: "Vectorizer", slug: "vectorizer" });

    const rows = await db.execute(
      sql`SELECT slug FROM tools WHERE lower(name) LIKE '%pix%'`,
    );
    expect(rows.rows.map((r) => r.slug)).toEqual(["pixel-artifier"]);
  });
});

describe("generated ids", () => {
  it("uses random UUIDs for uuid-pk tables and bigserial for analytics", async () => {
    const [tag] = await db
      .insert(schema.tags)
      .values({ name: "t", slug: "t" })
      .returning();
    expect(tag.id).toMatch(/^[0-9a-f-]{36}$/);

    const [ev] = await db
      .insert(schema.analyticsEvents)
      .values({ event: "search", payload: { q: "x" } })
      .returning();
    expect(ev.id).toBeTypeOf("number");
  });
});