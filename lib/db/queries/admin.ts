import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
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
  totalModels: number;
  totalSubscriptions: number;
  totalNotificationEvents: number;
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

  const [modelCount] = await database.select({ value: count() }).from(s.models);
  const [subscriptionCount] = await database
    .select({ value: count() })
    .from(s.alertSubscriptions);
  const [eventCount] = await database
    .select({ value: count() })
    .from(s.notificationEvents);

  return {
    totalTools,
    byStatus,
    totalSources,
    activeSources,
    totalRuns: Number(runCount?.value ?? 0),
    lastRunAt: lastRun?.startedAt ?? null,
    failedRuns: Number(failed?.value ?? 0),
    totalModels: Number(modelCount?.value ?? 0),
    totalSubscriptions: Number(subscriptionCount?.value ?? 0),
    totalNotificationEvents: Number(eventCount?.value ?? 0),
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

// ---------------------------------------------------------------------------
// Models (admin)
// ---------------------------------------------------------------------------

export interface ListModelsArgs {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listModelsForAdmin(
  args: ListModelsArgs = {},
  database: Db = defaultDb,
): Promise<{
  items: Array<{
    id: string;
    name: string;
    slug: string;
    providerName: string | null;
    status: ContentStatusValue;
    isDownloadable: boolean;
    contextWindow: number | null;
    updatedAt: Date;
    updatedCount: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
  status?: ContentStatusValue;
  q?: string;
}> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, args.pageSize ?? 20));

  const filters = [];
  const status = isContentStatus(args.status) ? args.status : undefined;
  if (status) filters.push(eq(s.models.status, status));
  const q = args.q?.trim();
  if (q) {
    filters.push(
      or(ilike(s.models.name, `%${q}%`), ilike(s.models.slug, `%${q}%`)),
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await database
    .select({
      id: s.models.id,
      name: s.models.name,
      slug: s.models.slug,
      providerName: s.modelProviders.name,
      status: s.models.status,
      isDownloadable: s.models.isDownloadable,
      contextWindow: s.models.contextWindow,
      updatedAt: s.models.updatedAt,
      updatedCount: count(s.modelUpdates.id),
    })
    .from(s.models)
    .leftJoin(s.modelProviders, eq(s.modelProviders.id, s.models.providerId))
    .leftJoin(s.modelUpdates, eq(s.modelUpdates.modelId, s.models.id))
    .where(where)
    .groupBy(s.models.id, s.modelProviders.name)
    .orderBy(desc(s.models.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.models)
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

export async function getModelForAdmin(id: string, database: Db = defaultDb) {
  const [model] = await database
    .select()
    .from(s.models)
    .where(eq(s.models.id, id))
    .limit(1);
  if (!model) return null;

  const provider = model.providerId
    ? ((await database
        .select()
        .from(s.modelProviders)
        .where(eq(s.modelProviders.id, model.providerId))
        .limit(1))[0] ?? null)
    : null;

  const sources = await database
    .select()
    .from(s.modelSources)
    .where(eq(s.modelSources.modelId, id))
    .orderBy(desc(s.modelSources.lastSeenAt));

  const updates = await database
    .select()
    .from(s.modelUpdates)
    .where(eq(s.modelUpdates.modelId, id))
    .orderBy(desc(s.modelUpdates.createdAt))
    .limit(20);

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

  const subscriptions = await database
    .select()
    .from(s.alertSubscriptions)
    .where(eq(s.alertSubscriptions.targetId, id))
    .orderBy(desc(s.alertSubscriptions.createdAt))
    .limit(20);

  return { model, provider, sources, updates, revisions, subscriptions };
}

// ---------------------------------------------------------------------------
// Change-alert subscriptions + notification events (admin)
// ---------------------------------------------------------------------------

export async function listSubscriptionsForAdmin(
  args: { page?: number; pageSize?: number; channel?: string; status?: string } = {},
  database: Db = defaultDb,
) {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, args.pageSize ?? 20));

  const filters: Parameters<typeof and>[0][] = [];
  if (args.channel === "email" || args.channel === "telegram") {
    filters.push(eq(s.alertSubscriptions.channel, args.channel));
  }
  const subStatusValues = new Set<string>(s.subStatus.enumValues);
  if (args.status && subStatusValues.has(args.status)) {
    filters.push(
      eq(s.alertSubscriptions.status, args.status as typeof s.subStatus.enumValues[number]),
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await database
    .select({
      id: s.alertSubscriptions.id,
      receiver: s.alertSubscriptions.receiver,
      channel: s.alertSubscriptions.channel,
      targetType: s.alertSubscriptions.targetType,
      targetId: s.alertSubscriptions.targetId,
      targetName: sql<string | null>`coalesce(${s.models.name}, ${s.modelProviders.name})`,
      status: s.alertSubscriptions.status,
      verifiedAt: s.alertSubscriptions.verifiedAt,
      lastNotifiedAt: s.alertSubscriptions.lastNotifiedAt,
      createdAt: s.alertSubscriptions.createdAt,
      token: s.alertSubscriptions.token,
    })
    .from(s.alertSubscriptions)
    .leftJoin(s.models, eq(s.models.id, s.alertSubscriptions.targetId))
    .leftJoin(
      s.modelProviders,
      eq(s.modelProviders.id, s.alertSubscriptions.targetId),
    )
    .where(where)
    .orderBy(desc(s.alertSubscriptions.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.alertSubscriptions)
    .where(where);

  return { items, total: Number(totalRow?.value ?? 0), page, pageSize };
}

export async function listNotificationEventsForAdmin(
  args: { page?: number; pageSize?: number } = {},
  database: Db = defaultDb,
) {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, args.pageSize ?? 20));

  const events = await database
    .select({
      id: s.notificationEvents.id,
      status: s.notificationEvents.status,
      modelUpdateId: s.notificationEvents.modelUpdateId,
      modelName: s.models.name,
      error: s.notificationEvents.error,
      createdAt: s.notificationEvents.createdAt,
      processedAt: s.notificationEvents.processedAt,
      logCount: count(s.notificationLogs.id),
      deliveredCount: sql<number>`count(*) FILTER (WHERE ${s.notificationLogs.status} = 'delivered')`,
      failedCount: sql<number>`count(*) FILTER (WHERE ${s.notificationLogs.status} = 'failed')`,
    })
    .from(s.notificationEvents)
    .leftJoin(s.modelUpdates, eq(s.modelUpdates.id, s.notificationEvents.modelUpdateId))
    .leftJoin(s.models, eq(s.models.id, s.modelUpdates.modelId))
    .leftJoin(s.notificationLogs, eq(s.notificationLogs.eventId, s.notificationEvents.id))
    .groupBy(s.notificationEvents.id, s.models.name)
    .orderBy(desc(s.notificationEvents.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.notificationEvents);

  const logs = await database
    .select({
      id: s.notificationLogs.id,
      eventId: s.notificationLogs.eventId,
      channel: s.notificationLogs.channel,
      receiver: s.alertSubscriptions.receiver,
      status: s.notificationLogs.status,
      error: s.notificationLogs.error,
      createdAt: s.notificationLogs.createdAt,
    })
    .from(s.notificationLogs)
    .leftJoin(
      s.alertSubscriptions,
      eq(s.alertSubscriptions.id, s.notificationLogs.subscriptionId),
    )
    .orderBy(desc(s.notificationLogs.createdAt))
    .limit(50);

  return { events, logs, total: Number(totalRow?.value ?? 0), page, pageSize };
}
