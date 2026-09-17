import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import {
  getActiveSponsorship,
  listActiveSponsoredTools,
} from "@/lib/db/queries/public";
import { clearDb } from "../db/helpers";

beforeEach(async () => {
  await clearDb();
});

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seed() {
  const [category] = await db
    .insert(schema.categories)
    .values({ nameAr: "تصنيف", nameEn: "Category", slug: "cat" })
    .returning();

  const [active, draftTool, other, unsponsored] = await db
    .insert(schema.tools)
    .values([
      { name: "Active Sponsor", slug: "active-sponsor", categoryId: category.id, status: "published" },
      { name: "Draft Tool", slug: "draft-tool", categoryId: category.id, status: "draft" },
      { name: "Organic Tool", slug: "organic-tool", categoryId: category.id, status: "published" },
      { name: "No Sponsor", slug: "no-sponsor", categoryId: category.id, status: "published" },
    ])
    .returning();

  await db.insert(schema.sponsoredListings).values([
    {
      toolId: active.id,
      placement: "featured",
      startDate: daysFromNow(-1),
      endDate: daysFromNow(1),
      campaignStatus: "active",
      externalReference: "PO-1",
    },
    {
      toolId: other.id,
      placement: "featured",
      startDate: daysFromNow(-1),
      endDate: daysFromNow(1),
      campaignStatus: "draft",
    },
    {
      toolId: other.id,
      placement: "featured",
      startDate: daysFromNow(-10),
      endDate: daysFromNow(-5),
      campaignStatus: "active",
    },
    {
      toolId: other.id,
      placement: "listings",
      startDate: daysFromNow(-1),
      endDate: daysFromNow(1),
      campaignStatus: "active",
    },
    {
      toolId: draftTool.id,
      placement: "featured",
      startDate: daysFromNow(-1),
      endDate: daysFromNow(1),
      campaignStatus: "active",
    },
  ]);

  return { active, other, unsponsored };
}

describe("listActiveSponsoredTools", () => {
  it("returns only active, in-window campaigns for the requested placement", async () => {
    const { active } = await seed();
    const items = await listActiveSponsoredTools("featured", 5);
    expect(items.map((item) => item.id)).toEqual([active.id]);
    expect(items[0].sponsoredReference).toBe("PO-1");
  });

  it("scopes results to the placement", async () => {
    await seed();
    const listings = await listActiveSponsoredTools("listings", 5);
    expect(listings).toHaveLength(1);
    expect(listings[0].slug).toBe("organic-tool");
  });

  it("respects the limit", async () => {
    await seed();
    const items = await listActiveSponsoredTools("featured", 1);
    expect(items).toHaveLength(1);
  });
});

describe("getActiveSponsorship", () => {
  it("returns an active campaign for a tool", async () => {
    const { active } = await seed();
    const row = await getActiveSponsorship(active.id);
    expect(row).toMatchObject({ placement: "featured", externalReference: "PO-1" });
  });

  it("returns null when no active campaign exists", async () => {
    const { unsponsored } = await seed();
    expect(await getActiveSponsorship(unsponsored.id)).toBeNull();
  });

  it("returns null for an unknown tool id", async () => {
    await seed();
    expect(
      await getActiveSponsorship("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });
});
