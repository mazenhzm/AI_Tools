import { asc, count, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export async function listCategoriesWithCounts(database: Db = defaultDb) {
  return database
    .select({
      id: s.categories.id,
      nameAr: s.categories.nameAr,
      nameEn: s.categories.nameEn,
      slug: s.categories.slug,
      descriptionAr: s.categories.descriptionAr,
      updatedAt: s.categories.updatedAt,
      toolCount: count(s.tools.id),
    })
    .from(s.categories)
    .leftJoin(s.tools, eq(s.tools.categoryId, s.categories.id))
    .groupBy(s.categories.id)
    .orderBy(asc(s.categories.nameAr));
}

export async function listTagsWithCounts(limit = 200, database: Db = defaultDb) {
  return database
    .select({
      id: s.tags.id,
      name: s.tags.name,
      slug: s.tags.slug,
      toolCount: count(s.toolTags.toolId),
    })
    .from(s.tags)
    .leftJoin(s.toolTags, eq(s.toolTags.tagId, s.tags.id))
    .groupBy(s.tags.id)
    .orderBy(desc(count(s.toolTags.toolId)), asc(s.tags.name))
    .limit(limit);
}

export async function listCollectionsWithCounts(database: Db = defaultDb) {
  return database
    .select({
      id: s.collections.id,
      titleAr: s.collections.titleAr,
      titleEn: s.collections.titleEn,
      slug: s.collections.slug,
      status: s.collections.status,
      updatedAt: s.collections.updatedAt,
      toolCount: count(s.collectionTools.toolId),
    })
    .from(s.collections)
    .leftJoin(
      s.collectionTools,
      eq(s.collectionTools.collectionId, s.collections.id),
    )
    .groupBy(s.collections.id)
    .orderBy(asc(s.collections.titleAr));
}

export async function getCollectionForAdmin(
  id: string,
  database: Db = defaultDb,
) {
  const [collection] = await database
    .select()
    .from(s.collections)
    .where(eq(s.collections.id, id))
    .limit(1);
  if (!collection) return null;

  const members = await database
    .select({
      toolId: s.tools.id,
      name: s.tools.name,
      slug: s.tools.slug,
      status: s.tools.status,
      position: s.collectionTools.position,
    })
    .from(s.collectionTools)
    .innerJoin(s.tools, eq(s.tools.id, s.collectionTools.toolId))
    .where(eq(s.collectionTools.collectionId, id))
    .orderBy(asc(s.collectionTools.position));

  const availableTools = await database
    .select({
      id: s.tools.id,
      name: s.tools.name,
      status: s.tools.status,
    })
    .from(s.tools)
    .orderBy(asc(s.tools.name))
    .limit(500);

  return { collection, members, availableTools };
}

export async function listSponsoredListings(database: Db = defaultDb) {
  return database
    .select({
      id: s.sponsoredListings.id,
      toolId: s.sponsoredListings.toolId,
      toolName: s.tools.name,
      placement: s.sponsoredListings.placement,
      startDate: s.sponsoredListings.startDate,
      endDate: s.sponsoredListings.endDate,
      campaignStatus: s.sponsoredListings.campaignStatus,
      externalReference: s.sponsoredListings.externalReference,
    })
    .from(s.sponsoredListings)
    .leftJoin(s.tools, eq(s.tools.id, s.sponsoredListings.toolId))
    .orderBy(desc(s.sponsoredListings.updatedAt));
}
