import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export type PricingValue = (typeof s.pricingType.enumValues)[number];
export type SortValue = "relevance" | "newest" | "name";

const PUBLISHED = eq(s.tools.status, "published");

const SEARCH_VECTOR = sql`(setweight(to_tsvector('simple', coalesce(${s.tools.name}, '')), 'A') || setweight(to_tsvector('simple', coalesce(${s.tools.descriptionAr}, '')), 'B') || setweight(to_tsvector('simple', coalesce(${s.tools.descriptionEn}, '')), 'B'))`;

const cardColumns = {
  id: s.tools.id,
  name: s.tools.name,
  slug: s.tools.slug,
  shortDescriptionAr: s.tools.shortDescriptionAr,
  shortDescriptionEn: s.tools.shortDescriptionEn,
  websiteUrl: s.tools.websiteUrl,
  logoUrl: s.tools.logoUrl,
  pricingType: s.tools.pricingType,
  isFeatured: s.tools.isFeatured,
  qualityScore: s.tools.qualityScore,
  publishedAt: s.tools.publishedAt,
  updatedAt: s.tools.updatedAt,
  categoryNameAr: s.categories.nameAr,
  categorySlug: s.categories.slug,
};

export interface PublicToolCard {
  id: string;
  name: string;
  slug: string;
  shortDescriptionAr: string | null;
  shortDescriptionEn: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  pricingType: PricingValue;
  isFeatured: boolean;
  qualityScore: string;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryNameAr: string | null;
  categorySlug: string | null;
}

export interface ListPublicToolsArgs {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  pricing?: string;
  featuredOnly?: boolean;
  q?: string;
  sort?: SortValue;
}

export function isPricingValue(value: unknown): value is PricingValue {
  return (
    typeof value === "string" &&
    (s.pricingType.enumValues as readonly string[]).includes(value)
  );
}

function buildFilters(args: ListPublicToolsArgs) {
  const filters = [PUBLISHED];
  if (args.categorySlug) {
    filters.push(eq(s.categories.slug, args.categorySlug));
  }
  if (isPricingValue(args.pricing)) {
    filters.push(eq(s.tools.pricingType, args.pricing));
  }
  if (args.featuredOnly) {
    filters.push(eq(s.tools.isFeatured, true));
  }
  const q = args.q?.trim();
  if (q) {
    filters.push(
      or(
        sql`${SEARCH_VECTOR} @@ websearch_to_tsquery('simple', ${q})`,
        ilike(s.tools.name, `%${q}%`),
      )!,
    );
  }
  return filters;
}

export async function listPublicTools(
  args: ListPublicToolsArgs = {},
  database: Db = defaultDb,
): Promise<{
  items: PublicToolCard[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(48, Math.max(6, args.pageSize ?? 12));
  const where = and(...buildFilters(args));
  const q = args.q?.trim();

  const orderBy = [];
  if (args.sort === "name") {
    orderBy.push(asc(s.tools.name));
  } else if (args.sort === "newest" || !q) {
    orderBy.push(desc(s.tools.publishedAt), desc(s.tools.updatedAt));
  } else {
    orderBy.push(
      desc(sql`ts_rank(${SEARCH_VECTOR}, websearch_to_tsquery('simple', ${q}))`),
      desc(s.tools.publishedAt),
    );
  }

  const items = await database
    .select(cardColumns)
    .from(s.tools)
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await database
    .select({ value: count() })
    .from(s.tools)
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(where);

  return { items, total: Number(totalRow?.value ?? 0), page, pageSize };
}

export async function listFeaturedTools(
  limit = 6,
  database: Db = defaultDb,
): Promise<PublicToolCard[]> {
  return database
    .select(cardColumns)
    .from(s.tools)
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(and(PUBLISHED, eq(s.tools.isFeatured, true)))
    .orderBy(desc(s.tools.publishedAt))
    .limit(limit);
}

export async function listLatestTools(
  limit = 8,
  database: Db = defaultDb,
): Promise<PublicToolCard[]> {
  return database
    .select(cardColumns)
    .from(s.tools)
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(PUBLISHED)
    .orderBy(desc(s.tools.publishedAt), desc(s.tools.updatedAt))
    .limit(limit);
}

export async function listPublicCategories(database: Db = defaultDb) {
  return database
    .select({
      id: s.categories.id,
      nameAr: s.categories.nameAr,
      nameEn: s.categories.nameEn,
      slug: s.categories.slug,
      descriptionAr: s.categories.descriptionAr,
      toolCount: count(s.tools.id),
    })
    .from(s.categories)
    .leftJoin(
      s.tools,
      and(eq(s.tools.categoryId, s.categories.id), PUBLISHED),
    )
    .groupBy(s.categories.id)
    .orderBy(asc(s.categories.nameAr));
}

export async function getCategoryBySlug(slug: string, database: Db = defaultDb) {
  const [category] = await database
    .select()
    .from(s.categories)
    .where(eq(s.categories.slug, slug))
    .limit(1);
  return category ?? null;
}

export async function getToolBySlug(slug: string, database: Db = defaultDb) {
  const [row] = await database
    .select({
      tool: s.tools,
      category: {
        id: s.categories.id,
        nameAr: s.categories.nameAr,
        nameEn: s.categories.nameEn,
        slug: s.categories.slug,
      },
    })
    .from(s.tools)
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(and(eq(s.tools.slug, slug), PUBLISHED))
    .limit(1);
  if (!row) return null;

  const [tags, features, updates, collections] = await Promise.all([
    database
      .select({ name: s.tags.name, slug: s.tags.slug })
      .from(s.toolTags)
      .innerJoin(s.tags, eq(s.tags.id, s.toolTags.tagId))
      .where(eq(s.toolTags.toolId, row.tool.id)),
    database
      .select({ nameAr: s.features.nameAr, nameEn: s.features.nameEn })
      .from(s.toolFeatures)
      .innerJoin(s.features, eq(s.features.id, s.toolFeatures.featureId))
      .where(eq(s.toolFeatures.toolId, row.tool.id)),
    database
      .select({
        id: s.updates.id,
        title: s.updates.title,
        contentAr: s.updates.contentAr,
        publishedAt: s.updates.publishedAt,
      })
      .from(s.updates)
      .where(and(eq(s.updates.toolId, row.tool.id), eq(s.updates.status, "published")))
      .orderBy(desc(s.updates.publishedAt))
      .limit(10),
    database
      .select({
        id: s.collections.id,
        titleAr: s.collections.titleAr,
        slug: s.collections.slug,
      })
      .from(s.collectionTools)
      .innerJoin(
        s.collections,
        eq(s.collections.id, s.collectionTools.collectionId),
      )
      .where(
        and(
          eq(s.collectionTools.toolId, row.tool.id),
          eq(s.collections.status, "published"),
        ),
      )
      .orderBy(asc(s.collections.titleAr)),
  ]);

  const related = row.tool.categoryId
    ? await database
        .select(cardColumns)
        .from(s.tools)
        .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
        .where(
          and(
            PUBLISHED,
            eq(s.tools.categoryId, row.tool.categoryId),
            sql`${s.tools.id} <> ${row.tool.id}`,
          ),
        )
        .orderBy(desc(s.tools.publishedAt))
        .limit(6)
    : [];

  return {
    tool: row.tool,
    category: row.category?.id ? row.category : null,
    tags,
    features,
    updates,
    collections,
    related,
  };
}

export async function listPublicCollections(database: Db = defaultDb) {
  return database
    .select({
      id: s.collections.id,
      titleAr: s.collections.titleAr,
      titleEn: s.collections.titleEn,
      slug: s.collections.slug,
      descriptionAr: s.collections.descriptionAr,
      toolCount: count(s.collectionTools.toolId),
    })
    .from(s.collections)
    .leftJoin(
      s.collectionTools,
      eq(s.collectionTools.collectionId, s.collections.id),
    )
    .where(eq(s.collections.status, "published"))
    .groupBy(s.collections.id)
    .orderBy(asc(s.collections.titleAr));
}

export async function getCollectionBySlug(
  slug: string,
  database: Db = defaultDb,
) {
  const [collection] = await database
    .select()
    .from(s.collections)
    .where(
      and(
        eq(s.collections.slug, slug),
        eq(s.collections.status, "published"),
      ),
    )
    .limit(1);
  if (!collection) return null;

  const tools = await database
    .select(cardColumns)
    .from(s.collectionTools)
    .innerJoin(s.tools, eq(s.tools.id, s.collectionTools.toolId))
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(
      and(
        eq(s.collectionTools.collectionId, collection.id),
        PUBLISHED,
      ),
    )
    .orderBy(asc(s.collectionTools.position));

  return { collection, tools };
}

export async function listPublicToolSlugs(database: Db = defaultDb) {
  return database
    .select({ slug: s.tools.slug, updatedAt: s.tools.updatedAt })
    .from(s.tools)
    .where(PUBLISHED)
    .orderBy(desc(s.tools.updatedAt));
}

export async function listPublicCollectionSlugs(database: Db = defaultDb) {
  return database
    .select({ slug: s.collections.slug, updatedAt: s.collections.updatedAt })
    .from(s.collections)
    .where(eq(s.collections.status, "published"));
}

export async function listPublicCategorySlugs(database: Db = defaultDb) {
  return database
    .select({ slug: s.categories.slug })
    .from(s.categories)
    .orderBy(asc(s.categories.slug));
}

export async function countPublishedTools(database: Db = defaultDb) {
  const [row] = await database
    .select({ value: count() })
    .from(s.tools)
    .where(PUBLISHED);
  return Number(row?.value ?? 0);
}

/**
 * Sponsored tools for a placement: campaign active, inside its date window and
 * the tool itself published. Sponsors are always rendered separately from the
 * organic results and clearly labelled by the caller.
 */
export async function listActiveSponsoredTools(
  placement: string,
  limit = 4,
  database: Db = defaultDb,
): Promise<Array<PublicToolCard & { sponsoredReference: string | null }>> {
  const today = new Date().toISOString().slice(0, 10);
  return database
    .select({ ...cardColumns, sponsoredReference: s.sponsoredListings.externalReference })
    .from(s.sponsoredListings)
    .innerJoin(s.tools, eq(s.tools.id, s.sponsoredListings.toolId))
    .leftJoin(s.categories, eq(s.categories.id, s.tools.categoryId))
    .where(
      and(
        PUBLISHED,
        eq(s.sponsoredListings.campaignStatus, "active"),
        eq(s.sponsoredListings.placement, placement),
        lte(s.sponsoredListings.startDate, today),
        gte(s.sponsoredListings.endDate, today),
      ),
    )
    .orderBy(desc(s.sponsoredListings.updatedAt))
    .limit(limit);
}

export async function getActiveSponsorship(
  toolId: string,
  database: Db = defaultDb,
): Promise<{ id: string; placement: string; externalReference: string | null } | null> {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await database
    .select({
      id: s.sponsoredListings.id,
      placement: s.sponsoredListings.placement,
      externalReference: s.sponsoredListings.externalReference,
    })
    .from(s.sponsoredListings)
    .where(
      and(
        eq(s.sponsoredListings.toolId, toolId),
        eq(s.sponsoredListings.campaignStatus, "active"),
        lte(s.sponsoredListings.startDate, today),
        gte(s.sponsoredListings.endDate, today),
      ),
    )
    .orderBy(desc(s.sponsoredListings.updatedAt))
    .limit(1);
  return row ?? null;
}
