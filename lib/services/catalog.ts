import { eq, inArray } from "drizzle-orm";
import { requireActor } from "@/lib/auth/authorization";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import { isUniqueViolation } from "@/lib/db/errors";
import * as s from "@/lib/db/schema";
import { slugify } from "@/lib/utils/text";

export type ContentStatusValue = (typeof s.contentStatus.enumValues)[number];

export interface CatalogResult {
  ok: boolean;
  id?: string;
  slug?: string;
  error?: string;
}

const CONTENT_STATUSES = new Set<string>(s.contentStatus.enumValues);

export function isContentStatus(value: unknown): value is ContentStatusValue {
  return typeof value === "string" && CONTENT_STATUSES.has(value);
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

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(args: {
  actor: unknown;
  nameAr: string;
  nameEn: string;
  slug?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  database?: Db;
}): Promise<CatalogResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const nameAr = args.nameAr?.trim() ?? "";
  const nameEn = args.nameEn?.trim() ?? "";
  if (!nameAr || !nameEn) {
    return { ok: false, error: "Arabic and English names are required" };
  }
  const slug = slugify(args.slug?.trim() || nameAr);
  if (!slug) return { ok: false, error: "Cannot derive a slug from the name" };

  try {
    const [row] = await database
      .insert(s.categories)
      .values({
        nameAr,
        nameEn,
        slug,
        descriptionAr: args.descriptionAr ?? null,
        descriptionEn: args.descriptionEn ?? null,
      })
      .returning();
    await logRevision(
      database,
      "category",
      row.id,
      "create",
      null,
      { nameAr, nameEn, slug },
      actor.id,
    );
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "A category with this slug already exists" };
    }
    throw err;
  }
}

export async function updateCategory(args: {
  actor: unknown;
  categoryId: string;
  fields: {
    nameAr?: string;
    nameEn?: string;
    slug?: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
  };
  database?: Db;
}): Promise<CatalogResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [category] = await database
    .select()
    .from(s.categories)
    .where(eq(s.categories.id, args.categoryId))
    .limit(1);
  if (!category) return { ok: false, error: "Category not found" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (args.fields.nameAr !== undefined) patch.nameAr = args.fields.nameAr.trim();
  if (args.fields.nameEn !== undefined) patch.nameEn = args.fields.nameEn.trim();
  if (args.fields.slug !== undefined) {
    const slug = slugify(args.fields.slug.trim());
    if (!slug) return { ok: false, error: "Invalid slug" };
    patch.slug = slug;
  }
  if (args.fields.descriptionAr !== undefined) {
    patch.descriptionAr = args.fields.descriptionAr;
  }
  if (args.fields.descriptionEn !== undefined) {
    patch.descriptionEn = args.fields.descriptionEn;
  }
  if (Object.keys(patch).length <= 1) {
    return { ok: false, error: "No changes supplied" };
  }

  try {
    const [row] = await database
      .update(s.categories)
      .set(patch)
      .where(eq(s.categories.id, args.categoryId))
      .returning();
    await logRevision(
      database,
      "category",
      row.id,
      "update",
      { nameAr: category.nameAr, slug: category.slug },
      patch,
      actor.id,
    );
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "A category with this slug already exists" };
    }
    throw err;
  }
}

export async function deleteCategory(args: {
  actor: unknown;
  categoryId: string;
  database?: Db;
}): Promise<CatalogResult> {
  requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  const [row] = await database
    .delete(s.categories)
    .where(eq(s.categories.id, args.categoryId))
    .returning();
  if (!row) return { ok: false, error: "Category not found" };
  return { ok: true, id: row.id };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function createTag(args: {
  actor: unknown;
  name: string;
  database?: Db;
}): Promise<CatalogResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const name = args.name?.trim() ?? "";
  const slug = slugify(name);
  if (!name || !slug) return { ok: false, error: "A tag name is required" };

  try {
    const [row] = await database
      .insert(s.tags)
      .values({ name, slug })
      .returning();
    await logRevision(
      database,
      "tag",
      row.id,
      "create",
      null,
      { name, slug },
      actor.id,
    );
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "This tag already exists" };
    }
    throw err;
  }
}

export async function deleteTag(args: {
  actor: unknown;
  tagId: string;
  database?: Db;
}): Promise<CatalogResult> {
  requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  const [row] = await database
    .delete(s.tags)
    .where(eq(s.tags.id, args.tagId))
    .returning();
  if (!row) return { ok: false, error: "Tag not found" };
  return { ok: true, id: row.id };
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function createCollection(args: {
  actor: unknown;
  titleAr: string;
  titleEn: string;
  slug?: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  status?: ContentStatusValue;
  database?: Db;
}): Promise<CatalogResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const titleAr = args.titleAr?.trim() ?? "";
  const titleEn = args.titleEn?.trim() ?? "";
  if (!titleAr || !titleEn) {
    return { ok: false, error: "Arabic and English titles are required" };
  }
  const slug = slugify(args.slug?.trim() || titleAr);
  if (!slug) return { ok: false, error: "Cannot derive a slug from the title" };

  try {
    const [row] = await database
      .insert(s.collections)
      .values({
        titleAr,
        titleEn,
        slug,
        descriptionAr: args.descriptionAr ?? null,
        descriptionEn: args.descriptionEn ?? null,
        status: args.status ?? "draft",
      })
      .returning();
    await logRevision(
      database,
      "collection",
      row.id,
      "create",
      null,
      { titleAr, titleEn, slug, status: row.status },
      actor.id,
    );
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "A collection with this slug already exists" };
    }
    throw err;
  }
}

export async function updateCollection(args: {
  actor: unknown;
  collectionId: string;
  fields: {
    titleAr?: string;
    titleEn?: string;
    slug?: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    status?: ContentStatusValue;
  };
  database?: Db;
}): Promise<CatalogResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [collection] = await database
    .select()
    .from(s.collections)
    .where(eq(s.collections.id, args.collectionId))
    .limit(1);
  if (!collection) return { ok: false, error: "Collection not found" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (args.fields.titleAr !== undefined) {
    patch.titleAr = args.fields.titleAr.trim();
  }
  if (args.fields.titleEn !== undefined) {
    patch.titleEn = args.fields.titleEn.trim();
  }
  if (args.fields.slug !== undefined) {
    const slug = slugify(args.fields.slug.trim());
    if (!slug) return { ok: false, error: "Invalid slug" };
    patch.slug = slug;
  }
  if (args.fields.descriptionAr !== undefined) {
    patch.descriptionAr = args.fields.descriptionAr;
  }
  if (args.fields.descriptionEn !== undefined) {
    patch.descriptionEn = args.fields.descriptionEn;
  }
  if (args.fields.status !== undefined) {
    if (!isContentStatus(args.fields.status)) {
      return { ok: false, error: "Invalid status" };
    }
    patch.status = args.fields.status;
  }
  if (Object.keys(patch).length <= 1) {
    return { ok: false, error: "No changes supplied" };
  }

  try {
    const [row] = await database
      .update(s.collections)
      .set(patch)
      .where(eq(s.collections.id, args.collectionId))
      .returning();
    await logRevision(
      database,
      "collection",
      row.id,
      "update",
      { titleAr: collection.titleAr, status: collection.status },
      patch,
      actor.id,
    );
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "A collection with this slug already exists" };
    }
    throw err;
  }
}

export async function deleteCollection(args: {
  actor: unknown;
  collectionId: string;
  database?: Db;
}): Promise<CatalogResult> {
  requireActor(args.actor, ["admin"]);
  const database = args.database ?? defaultDb;

  const [row] = await database
    .delete(s.collections)
    .where(eq(s.collections.id, args.collectionId))
    .returning();
  if (!row) return { ok: false, error: "Collection not found" };
  return { ok: true, id: row.id };
}

/**
 * Replaces the curated tool list of a collection, preserving the given order.
 * Unknown tool ids are ignored instead of failing the whole operation.
 */
export async function setCollectionTools(args: {
  actor: unknown;
  collectionId: string;
  toolIds: string[];
  database?: Db;
}): Promise<CatalogResult & { count?: number }> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [collection] = await database
    .select({ id: s.collections.id })
    .from(s.collections)
    .where(eq(s.collections.id, args.collectionId))
    .limit(1);
  if (!collection) return { ok: false, error: "Collection not found" };

  const unique = [...new Set(args.toolIds.filter((id) => id.length > 0))];
  const existing =
    unique.length > 0
      ? await database
          .select({ id: s.tools.id })
          .from(s.tools)
          .where(inArray(s.tools.id, unique))
      : [];
  const known = new Set(existing.map((row) => row.id));
  const ordered = unique.filter((id) => known.has(id));

  await database.transaction(async (tx) => {
    await tx
      .delete(s.collectionTools)
      .where(eq(s.collectionTools.collectionId, args.collectionId));
    if (ordered.length > 0) {
      await tx.insert(s.collectionTools).values(
        ordered.map((toolId, index) => ({
          collectionId: args.collectionId,
          toolId,
          position: index,
        })),
      );
    }
    await tx.insert(s.contentRevisions).values({
      entityType: "collection",
      entityId: args.collectionId,
      field: "tools",
      before: null,
      after: { toolIds: ordered },
      reason: "admin",
      editorId: actor.id,
    });
  });

  return { ok: true, id: args.collectionId, count: ordered.length };
}
