import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export interface PublicFeedItem {
  id: string;
  kind: "model" | "tool";
  title: string;
  contentAr: string;
  contentEn: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  entitySlug: string;
  entityName: string;
  providerName: string | null;
}

/**
 * Website-first change feed ("آخر التحديثات"). Union of published model
 * updates (published models only) and published tool updates (published tools
 * only), newest first. This is the single consumer-facing place where users
 * follow AI-world changes; there is no email/Telegram notification path.
 */
export async function listPublicUpdates(args?: {
  limit?: number;
  offset?: number;
  database?: Db;
}): Promise<PublicFeedItem[]> {
  const database = args?.database ?? defaultDb;
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;

  const [modelFeeds, toolFeeds] = await Promise.all([
    database
      .select({
        id: s.modelUpdates.id,
        title: s.modelUpdates.title,
        contentAr: s.modelUpdates.contentAr,
        contentEn: s.modelUpdates.contentEn,
        sourceUrl: s.modelUpdates.sourceUrl,
        publishedAt: s.modelUpdates.publishedAt,
        entitySlug: s.models.slug,
        entityName: s.models.name,
        providerName: s.modelProviders.name,
      })
      .from(s.modelUpdates)
      .innerJoin(s.models, eq(s.modelUpdates.modelId, s.models.id))
      .leftJoin(
        s.modelProviders,
        eq(s.models.providerId, s.modelProviders.id),
      )
      .where(
        and(
          eq(s.modelUpdates.status, "published"),
          isNotNull(s.modelUpdates.publishedAt),
          eq(s.models.status, "published"),
        ),
      )
      .orderBy(desc(s.modelUpdates.publishedAt)),
    database
      .select({
        id: s.updates.id,
        title: s.updates.title,
        contentAr: s.updates.contentAr,
        contentEn: s.updates.contentEn,
        sourceUrl: s.updates.sourceUrl,
        publishedAt: s.updates.publishedAt,
        entitySlug: s.tools.slug,
        entityName: s.tools.name,
      })
      .from(s.updates)
      .innerJoin(s.tools, eq(s.updates.toolId, s.tools.id))
      .where(
        and(
          eq(s.updates.status, "published"),
          isNotNull(s.updates.publishedAt),
          eq(s.tools.status, "published"),
        ),
      )
      .orderBy(desc(s.updates.publishedAt)),
  ]);

  const items: PublicFeedItem[] = [
    ...modelFeeds.map((row) => ({ ...row, kind: "model" as const })),
    ...toolFeeds.map((row) => ({
      ...row,
      kind: "tool" as const,
      providerName: null,
    })),
  ];
  items.sort(
    (a, b) =>
      new Date(b.publishedAt ?? 0).getTime() -
      new Date(a.publishedAt ?? 0).getTime(),
  );
  return items.slice(offset, offset + limit);
}

export async function countPublicUpdates(args?: {
  database?: Db;
}): Promise<number> {
  const database = args?.database ?? defaultDb;
  const items = await listPublicUpdates({ database, limit: 10_000 });
  return items.length;
}