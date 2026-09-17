import { and, desc, eq, sql } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import type { Db } from "@/lib/db/db";

export interface ToolUpdateInput {
  toolId: string;
  title: string | null;
  contentAr: string | null;
  sourceUrl: string | null;
  publishedAt: Date | null;
}

export type ToolUpdateOutcome = "created" | "exists" | "skipped";

/**
 * Records a change detected on a monitored source item as a tool update.
 * Updates are keyed by `source_url` (partial unique index), so re-seeing the
 * same change is a no-op and concurrent runs cannot duplicate it.
 */
export async function recordToolUpdate(
  database: Db,
  input: ToolUpdateInput,
): Promise<ToolUpdateOutcome> {
  const sourceUrl = input.sourceUrl?.trim() || null;
  const title = input.title?.trim() || null;
  const contentAr = input.contentAr?.trim() || null;

  if (!sourceUrl || (!title && !contentAr)) return "skipped";

  const [existing] = await database
    .select({ id: s.updates.id })
    .from(s.updates)
    .where(
      and(eq(s.updates.toolId, input.toolId), eq(s.updates.sourceUrl, sourceUrl)),
    )
    .limit(1);
  if (existing) return "exists";

  try {
    await database.insert(s.updates).values({
      toolId: input.toolId,
      title: title ?? sourceUrl,
      contentAr: contentAr ?? "",
      sourceUrl,
      publishedAt: input.publishedAt,
      status: "draft",
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "exists";
    throw error;
  }

  await database
    .update(s.tools)
    .set({ updatedAt: sql`now()` })
    .where(eq(s.tools.id, input.toolId));

  return "created";
}

/** Most recent monitored update for a tool, if any. */
export async function latestToolUpdate(
  database: Db,
  toolId: string,
): Promise<{ sourceUrl: string | null; createdAt: Date } | null> {
  const [row] = await database
    .select({ sourceUrl: s.updates.sourceUrl, createdAt: s.updates.createdAt })
    .from(s.updates)
    .where(eq(s.updates.toolId, toolId))
    .orderBy(desc(s.updates.createdAt))
    .limit(1);
  return row ?? null;
}
