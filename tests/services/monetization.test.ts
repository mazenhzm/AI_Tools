import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import {
  setSponsoredStatus,
  setToolAffiliateUrl,
  setToolFeatured,
  upsertSponsoredListing,
} from "@/lib/services/monetization";
import { clearDb } from "../db/helpers";

const admin = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "admin" as const,
};
const editor = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "editor@example.com",
  role: "editor" as const,
};

async function seedTool(name = "أداة"): Promise<string> {
  const [tool] = await db
    .insert(s.tools)
    .values({ name, slug: `tool-${Math.random().toString(36).slice(2, 10)}` })
    .returning();
  return tool.id;
}

beforeEach(async () => {
  await clearDb();
  await db.insert(s.administrators).values([
    { id: admin.id, email: admin.email, passwordHash: "test", role: "admin" },
    { id: editor.id, email: editor.email, passwordHash: "test", role: "editor" },
  ]);
});

describe("setToolFeatured", () => {
  it("lets editors feature a tool and records a revision", async () => {
    const toolId = await seedTool();
    const result = await setToolFeatured({
      actor: editor,
      toolId,
      featured: true,
    });
    expect(result.ok).toBe(true);

    const [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.isFeatured).toBe(true);

    const revisions = await db.select().from(s.contentRevisions);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].field).toBe("is_featured");
  });

  it("does nothing when the value is unchanged", async () => {
    const toolId = await seedTool();
    const result = await setToolFeatured({
      actor: admin,
      toolId,
      featured: false,
    });
    expect(result.ok).toBe(true);
    expect(await db.select().from(s.contentRevisions)).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const toolId = await seedTool();
    await expect(
      setToolFeatured({ actor: null, toolId, featured: true }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("setToolAffiliateUrl", () => {
  it("is admin-only", async () => {
    const toolId = await seedTool();
    await expect(
      setToolAffiliateUrl({
        actor: editor,
        toolId,
        affiliateUrl: "https://example.com/?ref=x",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("validates the URL and stores a normalized value", async () => {
    const toolId = await seedTool();

    const invalid = await setToolAffiliateUrl({
      actor: admin,
      toolId,
      affiliateUrl: "javascript:alert(1)",
    });
    expect(invalid.ok).toBe(false);

    const valid = await setToolAffiliateUrl({
      actor: admin,
      toolId,
      affiliateUrl: "https://example.com/?ref=x",
    });
    expect(valid.ok).toBe(true);

    const [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.affiliateUrl).toBe("https://example.com/?ref=x");
  });

  it("clears the affiliate URL with an empty value", async () => {
    const toolId = await seedTool();
    await setToolAffiliateUrl({
      actor: admin,
      toolId,
      affiliateUrl: "https://example.com/?ref=x",
    });
    await setToolAffiliateUrl({ actor: admin, toolId, affiliateUrl: "" });

    const [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.affiliateUrl).toBeNull();
  });
});

describe("sponsored listings", () => {
  it("validates dates and campaign status", async () => {
    const toolId = await seedTool();
    expect(
      (
        await upsertSponsoredListing({
          actor: admin,
          toolId,
          startDate: "2026/01/01",
          endDate: "2026-02-01",
        })
      ).ok,
    ).toBe(false);

    expect(
      (
        await upsertSponsoredListing({
          actor: admin,
          toolId,
          startDate: "2026-03-01",
          endDate: "2026-02-01",
        })
      ).ok,
    ).toBe(false);

    const created = await upsertSponsoredListing({
      actor: admin,
      toolId,
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      campaignStatus: "active",
      placement: "header",
    });
    expect(created.ok).toBe(true);

    const [listing] = await db.select().from(s.sponsoredListings);
    expect(listing.campaignStatus).toBe("active");
    expect(listing.placement).toBe("header");
    expect(listing.startDate).toBe("2026-01-01");

    const renamed = await upsertSponsoredListing({
      actor: admin,
      listingId: created.id,
      toolId,
      startDate: "2026-01-01",
      endDate: "2026-03-01",
    });
    expect(renamed.ok).toBe(true);

    const updated = await setSponsoredStatus({
      actor: admin,
      listingId: created.id!,
      campaignStatus: "ended",
    });
    expect(updated.ok).toBe(true);

    const [after] = await db.select().from(s.sponsoredListings);
    expect(after.endDate).toBe("2026-03-01");
    expect(after.campaignStatus).toBe("ended");
    expect(
      await db.select().from(s.contentRevisions),
    ).toHaveLength(3);
  });

  it("is admin-only and checks the tool exists", async () => {
    const toolId = await seedTool();
    await expect(
      upsertSponsoredListing({
        actor: editor,
        toolId,
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(
      (
        await upsertSponsoredListing({
          actor: admin,
          toolId: "00000000-0000-0000-0000-0000000000ff",
          startDate: "2026-01-01",
          endDate: "2026-02-01",
        })
      ).error,
    ).toBe("Tool not found");
  });
});
