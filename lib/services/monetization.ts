import { eq } from "drizzle-orm";
import { requireActor } from "@/lib/auth/authorization";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export type CampaignStatusValue = (typeof s.campaignStatus.enumValues)[number];

export interface MonetizationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const CAMPAIGN_STATUSES = new Set<string>(s.campaignStatus.enumValues);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCampaignStatus(value: unknown): value is CampaignStatusValue {
  return typeof value === "string" && CAMPAIGN_STATUSES.has(value);
}

async function logRevision(
  database: Db,
  entityType: string,
  entityId: string,
  field: string,
  before: unknown,
  after: unknown,
  editorId: string,
): Promise<void> {
  await database.insert(s.contentRevisions).values({
    entityType,
    entityId,
    field,
    before,
    after,
    reason: "admin",
    editorId,
  });
}

function normalizeUrl(value: string | null): string | null | "invalid" {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

export async function setToolFeatured(args: {
  actor: unknown;
  toolId: string;
  featured: boolean;
  database?: Db;
}): Promise<MonetizationResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [tool] = await database
    .select({ id: s.tools.id, isFeatured: s.tools.isFeatured })
    .from(s.tools)
    .where(eq(s.tools.id, args.toolId))
    .limit(1);
  if (!tool) return { ok: false, error: "Tool not found" };
  if (tool.isFeatured === args.featured) {
    return { ok: true, id: tool.id };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(s.tools)
      .set({ isFeatured: args.featured, updatedAt: new Date() })
      .where(eq(s.tools.id, args.toolId));
    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: args.toolId,
      field: "is_featured",
      before: { isFeatured: tool.isFeatured },
      after: { isFeatured: args.featured },
      reason: "admin",
      editorId: actor.id,
    });
  });

  return { ok: true, id: args.toolId };
}

export async function setToolAffiliateUrl(args: {
  actor: unknown;
  toolId: string;
  affiliateUrl: string | null;
  database?: Db;
}): Promise<MonetizationResult> {
  const actor = requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  const normalized = normalizeUrl(args.affiliateUrl);
  if (normalized === "invalid") {
    return { ok: false, error: "Affiliate URL must be an absolute http(s) URL" };
  }

  const [tool] = await database
    .select({ id: s.tools.id, affiliateUrl: s.tools.affiliateUrl })
    .from(s.tools)
    .where(eq(s.tools.id, args.toolId))
    .limit(1);
  if (!tool) return { ok: false, error: "Tool not found" };

  await database.transaction(async (tx) => {
    await tx
      .update(s.tools)
      .set({ affiliateUrl: normalized, updatedAt: new Date() })
      .where(eq(s.tools.id, args.toolId));
    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: args.toolId,
      field: "affiliate_url",
      before: { affiliateUrl: tool.affiliateUrl },
      after: { affiliateUrl: normalized },
      reason: "admin",
      editorId: actor.id,
    });
  });

  return { ok: true, id: args.toolId };
}

export async function upsertSponsoredListing(args: {
  actor: unknown;
  listingId?: string;
  toolId: string;
  placement?: string;
  startDate: string;
  endDate: string;
  campaignStatus?: CampaignStatusValue;
  externalReference?: string | null;
  database?: Db;
}): Promise<MonetizationResult> {
  const actor = requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  const startDate = args.startDate?.trim() ?? "";
  const endDate = args.endDate?.trim() ?? "";
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return { ok: false, error: "Dates must use the YYYY-MM-DD format" };
  }
  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after the start date" };
  }
  if (args.campaignStatus && !isCampaignStatus(args.campaignStatus)) {
    return { ok: false, error: "Invalid campaign status" };
  }

  const [tool] = await database
    .select({ id: s.tools.id })
    .from(s.tools)
    .where(eq(s.tools.id, args.toolId))
    .limit(1);
  if (!tool) return { ok: false, error: "Tool not found" };

  const values = {
    toolId: args.toolId,
    placement: args.placement?.trim() || "featured",
    startDate,
    endDate,
    campaignStatus: args.campaignStatus ?? "draft",
    externalReference: args.externalReference ?? null,
    updatedAt: new Date(),
  };

  if (args.listingId) {
    const [row] = await database
      .update(s.sponsoredListings)
      .set(values)
      .where(eq(s.sponsoredListings.id, args.listingId))
      .returning();
    if (!row) return { ok: false, error: "Sponsored listing not found" };
    await logRevision(
      database,
      "sponsored_listing",
      row.id,
      "update",
      null,
      values,
      actor.id,
    );
    return { ok: true, id: row.id };
  }

  const [row] = await database
    .insert(s.sponsoredListings)
    .values(values)
    .returning();
  await logRevision(
    database,
    "sponsored_listing",
    row.id,
    "create",
    null,
    values,
    actor.id,
  );
  return { ok: true, id: row.id };
}

export async function setSponsoredStatus(args: {
  actor: unknown;
  listingId: string;
  campaignStatus: CampaignStatusValue;
  database?: Db;
}): Promise<MonetizationResult> {
  const actor = requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  if (!isCampaignStatus(args.campaignStatus)) {
    return { ok: false, error: "Invalid campaign status" };
  }

  const [row] = await database
    .update(s.sponsoredListings)
    .set({ campaignStatus: args.campaignStatus, updatedAt: new Date() })
    .where(eq(s.sponsoredListings.id, args.listingId))
    .returning();
  if (!row) return { ok: false, error: "Sponsored listing not found" };

  await logRevision(
    database,
    "sponsored_listing",
    row.id,
    "status",
    null,
    { campaignStatus: args.campaignStatus },
    actor.id,
  );
  return { ok: true, id: row.id };
}
