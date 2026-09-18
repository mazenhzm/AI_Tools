import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export type ModelSortValue = "newest";

/** Models are ONLY published when an admin/editor explicitly publishes them. */
const MODEL_PUBLISHED = eq(s.models.status, "published");

export interface PublicModelCard {
  id: string;
  slug: string;
  name: string;
  providerId: string | null;
  providerName: string | null;
  providerSlug: string | null;
  modelIdentifier: string;
  releaseDate: string | null;
  currentVersion: string | null;
  isDownloadable: boolean;
  contextWindow: number | null;
  inputPricePer1M: string | null;
  outputPricePer1M: string | null;
  pricingNotes: string | null;
  modalities: string[];
  websiteUrl: string | null;
  descriptionAr: string;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface ProviderWithCount {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  modelCount: number;
}

export interface ListPublicModelsArgs {
  page?: number;
  pageSize?: number;
  providerSlug?: string;
  openSource?: boolean;
  sort?: ModelSortValue;
}

function modelCardColumns() {
  return {
    id: s.models.id,
    slug: s.models.slug,
    name: s.models.name,
    providerId: s.models.providerId,
    providerName: s.modelProviders.name,
    providerSlug: s.modelProviders.slug,
    modelIdentifier: s.models.modelIdentifier,
    releaseDate: s.models.releaseDate,
    currentVersion: s.models.currentVersion,
    isDownloadable: s.models.isDownloadable,
    contextWindow: s.models.contextWindow,
    inputPricePer1M: s.models.inputPricePer1M,
    outputPricePer1M: s.models.outputPricePer1M,
    pricingNotes: s.models.pricingNotes,
    modalities: s.models.modalities,
    websiteUrl: s.models.websiteUrl,
    descriptionAr: s.models.descriptionAr,
    publishedAt: s.models.publishedAt,
    updatedAt: s.models.updatedAt,
  };
}

export async function listModelProviders(
  database: Db = defaultDb,
): Promise<ProviderWithCount[]> {
  return database
    .select({
      id: s.modelProviders.id,
      name: s.modelProviders.name,
      slug: s.modelProviders.slug,
      websiteUrl: s.modelProviders.websiteUrl,
      modelCount: count(s.models.id),
    })
    .from(s.modelProviders)
    .leftJoin(s.models, and(eq(s.models.providerId, s.modelProviders.id), MODEL_PUBLISHED))
    .groupBy(s.modelProviders.id)
    .orderBy(desc(count(s.models.id)), asc(s.modelProviders.name));
}

export async function getProviderBySlug(slug: string, database: Db = defaultDb) {
  const [provider] = await database
    .select()
    .from(s.modelProviders)
    .where(eq(s.modelProviders.slug, slug))
    .limit(1);
  return provider ?? null;
}

/**
 * Public model catalog. Supports the real, source-backed filters (provider,
 * open-source) and the "newest" sort (publishedAt). "Most-used" is not offered
 * because the platform has no real usage metric — nothing is fabricated.
 */
export async function listPublicModels(
  args: ListPublicModelsArgs = {},
  database: Db = defaultDb,
): Promise<{
  items: PublicModelCard[];
  total: number;
  page: number;
  pageSize: number;
  sort: ModelSortValue;
}> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(48, Math.max(6, args.pageSize ?? 12));
  const sort = args.sort === "newest" ? "newest" : "newest";

  const filters = [MODEL_PUBLISHED];
  if (args.providerSlug) {
    filters.push(eq(s.modelProviders.slug, args.providerSlug));
  }
  if (args.openSource) {
    filters.push(eq(s.models.isDownloadable, true));
  }
  const where = and(...filters);

  const items = await database
    .select(modelCardColumns())
    .from(s.models)
    .leftJoin(s.modelProviders, eq(s.modelProviders.id, s.models.providerId))
    .where(where)
    .orderBy(desc(s.models.publishedAt), desc(s.models.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.models)
    .leftJoin(s.modelProviders, eq(s.modelProviders.id, s.models.providerId))
    .where(where);

  return {
    items,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
    sort,
  };
}

export async function getModelBySlug(slug: string, database: Db = defaultDb) {
  const [row] = await database
    .select({
      model: s.models,
      provider: {
        id: s.modelProviders.id,
        name: s.modelProviders.name,
        slug: s.modelProviders.slug,
        websiteUrl: s.modelProviders.websiteUrl,
      },
    })
    .from(s.models)
    .leftJoin(s.modelProviders, eq(s.modelProviders.id, s.models.providerId))
    .where(and(eq(s.models.slug, slug), MODEL_PUBLISHED))
    .limit(1);
  if (!row) return null;

  const updates = await database
    .select({
      id: s.modelUpdates.id,
      kind: s.modelUpdates.kind,
      title: s.modelUpdates.title,
      contentAr: s.modelUpdates.contentAr,
      sourceUrl: s.modelUpdates.sourceUrl,
      publishedAt: s.modelUpdates.publishedAt,
    })
    .from(s.modelUpdates)
    .where(
      and(
        eq(s.modelUpdates.modelId, row.model.id),
        eq(s.modelUpdates.status, "published"),
      ),
    )
    .orderBy(desc(s.modelUpdates.publishedAt))
    .limit(10);

  return { model: row.model, provider: row.provider?.id ? row.provider : null, updates };
}

export async function listPublicModelSlugs(database: Db = defaultDb) {
  return database
    .select({ slug: s.models.slug, updatedAt: s.models.updatedAt })
    .from(s.models)
    .where(MODEL_PUBLISHED)
    .orderBy(desc(s.models.updatedAt));
}

export async function countPublishedModels(database: Db = defaultDb) {
  const [row] = await database
    .select({ value: count() })
    .from(s.models)
    .where(MODEL_PUBLISHED);
  return Number(row?.value ?? 0);
}