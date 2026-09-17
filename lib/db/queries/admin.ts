import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export type ToolStatusValue = (typeof s.toolStatus.enumValues)[number];

const TOOL_STATUSES = new Set<string>(s.toolStatus.enumValues);

export function isToolStatus(value: unknown): value is ToolStatusValue {
  return typeof value === "string" && TOOL_STATUSES.has(value);
}

export type ContentStatusValue = (typeof s.contentStatus.enumValues)[number];

const CONTENT_STATUSES = new Set<string>(s.contentStatus.enumValues);

export function isContentStatus(value: unknown): value is ContentStatusValue {
  return typeof value === "string" && CONTENT_STATUSES.has(value);
}

export interface ListToolsArgs {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminToolListItem {
  id: string;
  name: string;
  slug: string;
  status: ToolStatusValue;
  qualityScore: string;
  pricingType: string;
  categoryId: string | null;
  updatedAt: Date;
}

export async function listToolsForAdmin(
  args: ListToolsArgs = {},
  database: Db = defaultDb,
): Promise<{
  items: AdminToolListItem[];
  total: number;
  page: number;
  pageSize: number;
  status?: ToolStatusValue;
  q?: string;
}> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, args.pageSize ?? 20));

  const filters = [];
  const status = isToolStatus(args.status) ? args.status : undefined;
  if (status) filters.push(eq(s.tools.status, status));
  const q = args.q?.trim();
  if (q) {
    filters.push(
      or(ilike(s.tools.name, `%${q}%`), ilike(s.tools.slug, `%${q}%`)),
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await database
    .select({
      id: s.tools.id,
      name: s.tools.name,
      slug: s.tools.slug,
      status: s.tools.status,
      qualityScore: s.tools.qualityScore,
      pricingType: s.tools.pricingType,
      categoryId: s.tools.categoryId,
      updatedAt: s.tools.updatedAt,
    })
    .from(s.tools)
    .where(where)
    .orderBy(desc(s.tools.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.tools)
    .where(where);

  return {
    items,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
    status,
    q,
  };
}

export async function getToolForAdmin(
  id: string,
  database: Db = defaultDb,
) {
  const [tool] = await database
    .select()
    .from(s.tools)
    .where(eq(s.tools.id, id))
    .limit(1);
  if (!tool) return null;

  const sources = await database
    .select({
      id: s.toolSources.id,
      sourceId: s.toolSources.sourceId,
      sourceItemId: s.toolSources.sourceItemId,
      firstSeenAt: s.toolSources.firstSeenAt,
      lastSeenAt: s.toolSources.lastSeenAt,
    })
    .from(s.toolSources)
    .where(eq(s.toolSources.toolId, id));

  const logs = await database
    .select()
    .from(s.aiProcessingLogs)
    .where(eq(s.aiProcessingLogs.toolId, id))
    .orderBy(desc(s.aiProcessingLogs.createdAt))
    .limit(5);

  const updates = await database
    .select({
      id: s.updates.id,
      title: s.updates.title,
      contentAr: s.updates.contentAr,
      sourceUrl: s.updates.sourceUrl,
      publishedAt: s.updates.publishedAt,
      status: s.updates.status,
      createdAt: s.updates.createdAt,
    })
    .from(s.updates)
    .where(eq(s.updates.toolId, id))
    .orderBy(desc(s.updates.createdAt))
    .limit(10);

  const revisions = await database
    .select({
      id: s.contentRevisions.id,
      field: s.contentRevisions.field,
      reason: s.contentRevisions.reason,
      createdAt: s.contentRevisions.createdAt,
    })
    .from(s.contentRevisions)
    .where(eq(s.contentRevisions.entityId, id))
    .orderBy(desc(s.contentRevisions.createdAt))
    .limit(10);

  let categoryName: string | null = null;
  if (tool.categoryId) {
    const [category] = await database
      .select({ nameAr: s.categories.nameAr })
      .from(s.categories)
      .where(eq(s.categories.id, tool.categoryId))
      .limit(1);
    categoryName = category?.nameAr ?? null;
  }

  return { tool, sources, logs, revisions, updates, categoryName };
}

export interface DashboardStats {
  totalTools: number;
  byStatus: Record<string, number>;
  totalSources: number;
  activeSources: number;
  totalRuns: number;
  lastRunAt: Date | null;
  failedRuns: number;
}

export async function adminDashboardStats(
  database: Db = defaultDb,
): Promise<DashboardStats> {
  const statusRows = await database
    .select({ status: s.tools.status, value: count() })
    .from(s.tools)
    .groupBy(s.tools.status);

  const byStatus: Record<string, number> = {};
  let totalTools = 0;
  for (const row of statusRows) {
    byStatus[row.status] = Number(row.value);
    totalTools += Number(row.value);
  }

  const sourceRows = await database
    .select({ active: s.sources.active, value: count() })
    .from(s.sources)
    .groupBy(s.sources.active);
  let totalSources = 0;
  let activeSources = 0;
  for (const row of sourceRows) {
    totalSources += Number(row.value);
    if (row.active) activeSources += Number(row.value);
  }

  const [runCount] = await database
    .select({ value: count() })
    .from(s.ingestionRuns);
  const [failed] = await database
    .select({ value: count() })
    .from(s.ingestionRuns)
    .where(eq(s.ingestionRuns.status, "failed"));
  const [lastRun] = await database
    .select({ startedAt: s.ingestionRuns.startedAt })
    .from(s.ingestionRuns)
    .orderBy(desc(s.ingestionRuns.startedAt))
    .limit(1);

  return {
    totalTools,
    byStatus,
    totalSources,
    activeSources,
    totalRuns: Number(runCount?.value ?? 0),
    lastRunAt: lastRun?.startedAt ?? null,
    failedRuns: Number(failed?.value ?? 0),
  };
}

export async function listSourcesForAdmin(database: Db = defaultDb) {
  return database
    .select()
    .from(s.sources)
    .orderBy(desc(s.sources.updatedAt));
}

export async function listIngestionRuns(
  args: { page?: number; pageSize?: number } = {},
  database: Db = defaultDb,
) {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, args.pageSize ?? 20));

  const items = await database
    .select({
      id: s.ingestionRuns.id,
      sourceId: s.ingestionRuns.sourceId,
      sourceName: s.sources.name,
      status: s.ingestionRuns.status,
      startedAt: s.ingestionRuns.startedAt,
      finishedAt: s.ingestionRuns.finishedAt,
      metrics: s.ingestionRuns.metrics,
      error: s.ingestionRuns.error,
    })
    .from(s.ingestionRuns)
    .leftJoin(s.sources, eq(s.ingestionRuns.sourceId, s.sources.id))
    .orderBy(desc(s.ingestionRuns.startedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.ingestionRuns);

  return { items, total: Number(totalRow?.value ?? 0), page, pageSize };
}
