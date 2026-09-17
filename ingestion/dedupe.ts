import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { normalizeName } from "@/lib/utils/text";
import type { NormalizedItem } from "./types";

export type MatchReason = "source_item" | "website_url" | "domain_name" | "slug" | "name";

export interface ExistingMatch {
  toolId: string | null;
  reason: MatchReason;
}

/**
 * Finds an existing tool for a normalized item using progressively weaker
 * signals. The `(source_id, source_item_id)` anchor is authoritative and makes
 * repeat runs idempotent; the others prevent duplicates across sources.
 */
export async function findExistingTool(
  item: NormalizedItem,
  sourceId: string,
  database: Db = defaultDb,
): Promise<ExistingMatch | null> {
  const anchored = await database
    .select({ toolId: s.toolSources.toolId })
    .from(s.toolSources)
    .where(
      and(
        eq(s.toolSources.sourceId, sourceId),
        eq(s.toolSources.sourceItemId, item.sourceItemId),
      ),
    )
    .limit(1);
  if (anchored.length > 0) {
    return { toolId: anchored[0].toolId, reason: "source_item" };
  }

  if (item.websiteUrl) {
    const byUrl = await database
      .select({ id: s.tools.id })
      .from(s.tools)
      .where(eq(s.tools.websiteUrl, item.websiteUrl))
      .limit(1);
    if (byUrl.length > 0) return { toolId: byUrl[0].id, reason: "website_url" };
  }

  const bySlug = await database
    .select({ id: s.tools.id })
    .from(s.tools)
    .where(eq(s.tools.slug, item.slug))
    .limit(1);
  if (bySlug.length > 0) return { toolId: bySlug[0].id, reason: "slug" };

  const byName = await database
    .select({ id: s.tools.id })
    .from(s.tools)
    .where(sql`lower(${s.tools.name}) = ${item.name.toLowerCase()}`)
    .limit(1);
  if (byName.length > 0) return { toolId: byName[0].id, reason: "name" };

  if (item.domain) {
    const candidates = await database
      .select({ id: s.tools.id, name: s.tools.name, websiteUrl: s.tools.websiteUrl })
      .from(s.tools)
      .where(sql`${s.tools.websiteUrl} ILIKE ${`%${item.domain}%`}`)
      .limit(50);
    const hit = candidates.find(
      (candidate) => normalizeName(candidate.name) === item.normalizedName,
    );
    if (hit) return { toolId: hit.id, reason: "domain_name" };
  }

  return null;
}
