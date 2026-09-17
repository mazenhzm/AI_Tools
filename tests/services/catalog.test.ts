import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { slugify } from "@/lib/utils/text";
import {
  createCategory,
  createCollection,
  createTag,
  deleteCategory,
  deleteCollection,
  deleteTag,
  setCollectionTools,
  updateCategory,
} from "@/lib/services/catalog";
import { clearDb } from "../db/helpers";

const admin = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "admin" as const,
};
const editor = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "editor@example.com",
  role: "editor" as const,
};

async function seedTool(name: string): Promise<string> {
  const [tool] = await db
    .insert(s.tools)
    .values({ name, slug: slugify(name) + "-" + Math.random().toString(36).slice(2, 8) })
    .returning();
  return tool.id;
}

beforeEach(async () => {
  await clearDb();
  await db.insert(s.administrators).values([
    { id: admin.id, email: admin.email, passwordHash: "test", role: "admin" },
    { id: editor.id, email: editor.email, passwordHash: "test", role: "editor" },
  ]);
});

describe("createCategory", () => {
  it("requires an authenticated actor", async () => {
    await expect(
      createCategory({ actor: null, nameAr: "أ", nameEn: "A" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("creates a category with a derived slug and a revision", async () => {
    const result = await createCategory({
      actor: editor,
      nameAr: "الإنتاجية",
      nameEn: "Productivity",
    });
    expect(result.ok).toBe(true);
    expect(result.slug).toBe(slugify("الإنتاجية"));

    const [category] = await db.select().from(s.categories);
    expect(category.nameAr).toBe("الإنتاجية");
    expect(category.nameEn).toBe("Productivity");

    const revisions = await db.select().from(s.contentRevisions);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].entityType).toBe("category");
    expect(revisions[0].editorId).toBe(editor.id);
  });

  it("rejects missing names and duplicate slugs", async () => {
    expect(
      (await createCategory({ actor: admin, nameAr: "", nameEn: "A" })).ok,
    ).toBe(false);

    await createCategory({
      actor: admin,
      nameAr: "كتابة",
      nameEn: "Writing",
      slug: "writing",
    });
    const duplicate = await createCategory({
      actor: admin,
      nameAr: "أخرى",
      nameEn: "Other",
      slug: "writing",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toContain("slug");
  });
});

describe("updateCategory", () => {
  it("patches fields and reports unknown ids / empty patches", async () => {
    const created = await createCategory({
      actor: admin,
      nameAr: "تصميم",
      nameEn: "Design",
    });
    const categoryId = created.id!;

    const updated = await updateCategory({
      actor: admin,
      categoryId,
      fields: { nameAr: "تصميم الجرافيك" },
    });
    expect(updated.ok).toBe(true);

    const [row] = await db.select().from(s.categories);
    expect(row.nameAr).toBe("تصميم الجرافيك");

    expect(
      (
        await updateCategory({
          actor: admin,
          categoryId: "00000000-0000-0000-0000-0000000000ff",
          fields: { nameAr: "x" },
        })
      ).error,
    ).toBe("Category not found");

    expect(
      (await updateCategory({ actor: admin, categoryId, fields: {} })).error,
    ).toBe("No changes supplied");
  });
});

describe("deleteCategory", () => {
  it("is admin-only and detaches tools instead of deleting them", async () => {
    const created = await createCategory({
      actor: admin,
      nameAr: "صوت",
      nameEn: "Audio",
    });
    const categoryId = created.id!;
    const toolId = await seedTool("أداة صوتية");
    await db
      .update(s.tools)
      .set({ categoryId })
      .where(eq(s.tools.id, toolId));

    await expect(
      deleteCategory({ actor: editor, categoryId }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const result = await deleteCategory({ actor: admin, categoryId });
    expect(result.ok).toBe(true);

    const [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.categoryId).toBeNull();
  });
});

describe("tags", () => {
  it("creates tags and rejects duplicates", async () => {
    const first = await createTag({ actor: editor, name: "كتابة" });
    expect(first.ok).toBe(true);
    const duplicate = await createTag({ actor: editor, name: "كتابة" });
    expect(duplicate.ok).toBe(false);
  });

  it("only admins may delete a tag", async () => {
    const created = await createTag({ actor: admin, name: "صوت" });
    await expect(
      deleteTag({ actor: editor, tagId: created.id! }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect((await deleteTag({ actor: admin, tagId: created.id! })).ok).toBe(
      true,
    );
  });
});

describe("collections", () => {
  it("creates a collection, stores an ordered tool list and ignores unknown ids", async () => {
    const created = await createCollection({
      actor: editor,
      titleAr: "أفضل أدوات الكتابة",
      titleEn: "Best writing tools",
    });
    expect(created.ok).toBe(true);
    const collectionId = created.id!;

    const first = await seedTool("أداة أولى");
    const second = await seedTool("أداة ثانية");

    const result = await setCollectionTools({
      actor: editor,
      collectionId,
      toolIds: [second, "00000000-0000-0000-0000-0000000000ff", first, second],
    });
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);

    const members = await db
      .select()
      .from(s.collectionTools)
      .orderBy(s.collectionTools.position);
    expect(members.map((member) => member.toolId)).toEqual([second, first]);
    expect(members.map((member) => member.position)).toEqual([0, 1]);

    const revisions = await db
      .select()
      .from(s.contentRevisions)
      .where(eq(s.contentRevisions.field, "tools"));
    expect(revisions).toHaveLength(1);
  });

  it("only admins may delete collections", async () => {
    const created = await createCollection({
      actor: editor,
      titleAr: "قائمة",
      titleEn: "List",
    });
    await expect(
      deleteCollection({ actor: editor, collectionId: created.id! }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(
      (await deleteCollection({ actor: admin, collectionId: created.id! })).ok,
    ).toBe(true);
  });

  it("refuses to attach tools to a missing collection", async () => {
    const result = await setCollectionTools({
      actor: admin,
      collectionId: "00000000-0000-0000-0000-0000000000ff",
      toolIds: [],
    });
    expect(result).toEqual({ ok: false, error: "Collection not found" });
  });
});
