import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import {
  countPublishedModels,
  getModelBySlug,
  listModelProviders,
  listPublicModelSlugs,
  listPublicModels,
} from "@/lib/db/queries/models";
import { clearDb } from "../db/helpers";

async function seedProvider(name: string, slug: string) {
  const [row] = await db
    .insert(s.modelProviders)
    .values({ name, slug })
    .returning();
  return row;
}

async function seedModel(
  overrides: Partial<typeof s.models.$inferInsert> = {},
) {
  const [row] = await db
    .insert(s.models)
    .values({
      name: "Alpha",
      slug: "provider-alpha",
      modelIdentifier: "alpha",
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      modalities: [],
      ...overrides,
    })
    .returning();
  return row;
}

beforeEach(async () => {
  await clearDb();
});

describe("listPublicModels", () => {
  it("exposes only published models", async () => {
    await seedModel();
    await seedModel({ slug: "provider-draft", status: "draft" });

    const result = await listPublicModels({}, db);
    expect(result.total).toBe(1);
    expect(result.items[0].slug).toBe("provider-alpha");
    expect(result.sort).toBe("newest");
  });

  it("filters by provider slug", async () => {
    const p1 = await seedProvider("One", "one");
    const p2 = await seedProvider("Two", "two");
    await seedModel({ providerId: p1.id, slug: "one-a", modelIdentifier: "a" });
    await seedModel({ providerId: p2.id, slug: "two-b", modelIdentifier: "b" });

    const result = await listPublicModels({ providerSlug: "two" }, db);
    expect(result.total).toBe(1);
    expect(result.items[0].slug).toBe("two-b");
  });

  it("filters by open-source (downloadable) toggle", async () => {
    await seedModel({ slug: "open-m", isDownloadable: true });
    await seedModel({ slug: "closed-m", isDownloadable: false, publishedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await listPublicModels({ openSource: true }, db);
    expect(result.total).toBe(1);
    expect(result.items[0].slug).toBe("open-m");
  });

  it("sorts newest first and paginates with a clamped page size", async () => {
    // listPublicModels clamps pageSize to a minimum of 6.
    for (let i = 1; i <= 7; i += 1) {
      await seedModel({
        slug: `model-${i}`,
        name: `Model ${i}`,
        publishedAt: new Date(`2026-03-${String(i).padStart(2, "0")}T00:00:00Z`),
      });
    }
    const page1 = await listPublicModels({ pageSize: 1, page: 1 }, db);
    expect(page1.pageSize).toBe(6);
    expect(page1.items).toHaveLength(6);
    expect(page1.total).toBe(7);
    expect(page1.items[0].slug).toBe("model-7");

    const page2 = await listPublicModels({ pageSize: 1, page: 2 }, db);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].slug).toBe("model-1");
  });

  it("only ever offers the newest sort (no fabricated most-used metric)", async () => {
    const result = await listPublicModels({}, db);
    expect(result.sort).toBe("newest");
  });
});

describe("getModelBySlug", () => {
  it("returns a published model with provider alias and published updates only", async () => {
    const provider = await seedProvider("One", "one");
    const model = await seedModel({
      providerId: provider.id,
      slug: "one-alpha",
    });
    await db.insert(s.modelUpdates).values({
      modelId: model.id,
      kind: "new_version",
      title: "إصدار جديد",
      sourceUrl: "https://one.example.com/changelog",
      status: "published",
      publishedAt: new Date("2026-02-01T00:00:00Z"),
      contentAr: "المحتوى",
    });
    await db.insert(s.modelUpdates).values({
      modelId: model.id,
      kind: "pricing",
      title: "تسعير",
      status: "draft",
      contentAr: "مسودة",
    });

    const result = await getModelBySlug("one-alpha", db);
    expect(result).not.toBeNull();
    expect(result!.provider?.name).toBe("One");
    expect(result!.updates).toHaveLength(1);
    expect(result!.updates[0].kind).toBe("new_version");
  });

  it("hides non-published models entirely", async () => {
    await seedModel({ slug: "draft-m", status: "draft" });
    expect(await getModelBySlug("draft-m", db)).toBeNull();
  });
});

describe("model catalog metadata", () => {
  it("lists providers ordered by published model count", async () => {
    const p1 = await seedProvider("Popular", "popular");
    const p2 = await seedProvider("Solo", "solo");
    await seedModel({ providerId: p1.id, slug: "popular-a" });
    await seedModel({ providerId: p1.id, slug: "popular-b" });
    await seedModel({ providerId: p1.id, slug: "popular-draft", status: "draft" });
    await seedModel({ providerId: p2.id, slug: "solo-a" });

    const providers = await listModelProviders(db);
    expect(providers[0].name).toBe("Popular");
    expect(providers[0].modelCount).toBe(2);
    expect(providers[1].name).toBe("Solo");
    expect(providers[1].modelCount).toBe(1);
  });

  it("exposes public slugs for the sitemap only for published models", async () => {
    await seedModel({ slug: "published-m" });
    await seedModel({ slug: "hidden-m", status: "draft" });
    const slugs = await listPublicModelSlugs(db);
    expect(slugs.map((row) => row.slug)).toEqual(["published-m"]);
  });

  it("counts published models for the admin dashboard", async () => {
    await seedModel();
    await seedModel({ slug: "second" });
    await seedModel({ slug: "third", status: "draft" });
    expect(await countPublishedModels(db)).toBe(2);
  });
});