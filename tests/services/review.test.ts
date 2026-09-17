import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AiProvider } from "@/lib/ai/provider";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import type { NormalizedItem } from "@/ingestion/types";
import {
  canTransitionTool,
  reprocessTool,
  setUpdateStatus,
  TOOL_STATUS_TRANSITIONS,
  transitionToolStatus,
  updateToolFields,
} from "@/lib/services/review";
import { clearDb } from "../db/helpers";
import { validEnrichment } from "../ai/fixtures";

const admin = { id: "00000000-0000-0000-0000-000000000001", email: "admin@example.com", role: "admin" as const };
const editor = { id: "00000000-0000-0000-0000-000000000002", email: "editor@example.com", role: "editor" as const };

function scriptedProvider(text: string): AiProvider {
  return {
    name: "scripted",
    model: "scripted-1",
    async generateJson() {
      return { text, model: "scripted-1", raw: { text } };
    },
  };
}

async function seedTool(
  status: (typeof s.toolStatus.enumValues)[number] = "draft",
): Promise<string> {
  const [tool] = await db
    .insert(s.tools)
    .values({ name: "أداة تجريبية", slug: `tool-${Date.now()}-${Math.random()}` , status })
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

describe("canTransitionTool", () => {
  it("allows documented transitions and refuses the rest", () => {
    expect(canTransitionTool("draft", "pending_review")).toBe(true);
    expect(canTransitionTool("published", "draft")).toBe(false);
    expect(canTransitionTool("rejected", "draft")).toBe(true);
    expect(canTransitionTool("published", "published")).toBe(true);
  });

  it("never exposes an unknown target state", () => {
    for (const targets of Object.values(TOOL_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(s.toolStatus.enumValues).toContain(target);
      }
    }
  });
});

describe("transitionToolStatus", () => {
  it("requires an authenticated actor", async () => {
    const toolId = await seedTool();
    await expect(
      transitionToolStatus({ actor: null, toolId, to: "pending_review" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("reports a missing tool instead of throwing", async () => {
    const result = await transitionToolStatus({
      actor: admin,
      toolId: "00000000-0000-0000-0000-0000000000ff",
      to: "pending_review",
    });
    expect(result).toEqual({ ok: false, error: "Tool not found" });
  });

  it("applies a valid transition and records a revision", async () => {
    const toolId = await seedTool("draft");
    const result = await transitionToolStatus({
      actor: admin,
      toolId,
      to: "pending_review",
    });
    expect(result).toEqual({ ok: true, status: "pending_review" });

    const [tool] = await db
      .select()
      .from(s.tools)
      .where(eq(s.tools.id, toolId));
    expect(tool.status).toBe("pending_review");

    const revisions = await db.select().from(s.contentRevisions);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].field).toBe("status");
    expect(revisions[0].reason).toBe("admin");
    expect(revisions[0].editorId).toBe(admin.id);
    expect(revisions[0].before).toEqual({ status: "draft" });
    expect(revisions[0].after).toEqual({ status: "pending_review" });
  });

  it("rejects an invalid transition without touching the row", async () => {
    const toolId = await seedTool("published");
    const result = await transitionToolStatus({
      actor: admin,
      toolId,
      to: "draft",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid transition");
    expect((await db.select().from(s.contentRevisions))).toHaveLength(0);
  });

  it("sets publishedAt on publish and clears it when leaving published", async () => {
    const toolId = await seedTool("approved");
    await transitionToolStatus({ actor: admin, toolId, to: "published" });
    let [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.publishedAt).toBeInstanceOf(Date);

    await transitionToolStatus({ actor: admin, toolId, to: "pending_review" });
    [tool] = await db.select().from(s.tools).where(eq(s.tools.id, toolId));
    expect(tool.publishedAt).toBeNull();
  });

  it("reserves archiving for admins", async () => {
    const toolId = await seedTool("published");
    await expect(
      transitionToolStatus({ actor: editor, toolId, to: "archived" }),
    ).rejects.toThrow("Only admins can archive tools");
  });

  it("is a no-op when the target equals the current status", async () => {
    const toolId = await seedTool("draft");
    const result = await transitionToolStatus({
      actor: admin,
      toolId,
      to: "draft",
    });
    expect(result).toEqual({ ok: true, status: "draft" });
    expect(await db.select().from(s.contentRevisions)).toHaveLength(0);
  });
});

describe("updateToolFields", () => {
  it("patches fields and snapshots the previous values", async () => {
    const toolId = await seedTool("draft");
    const result = await updateToolFields({
      actor: editor,
      toolId,
      fields: { descriptionAr: "وصف جديد", pricingType: "free" },
    });
    expect(result.ok).toBe(true);

    const [tool] = await db
      .select()
      .from(s.tools)
      .where(eq(s.tools.id, toolId));
    expect(tool.descriptionAr).toBe("وصف جديد");
    expect(tool.pricingType).toBe("free");

    const [revision] = await db.select().from(s.contentRevisions);
    expect(revision.field).toBe("fields");
    expect(revision.before).toMatchObject({ descriptionAr: "" });
  });

  it("refuses an empty patch", async () => {
    const toolId = await seedTool();
    const result = await updateToolFields({ actor: admin, toolId, fields: {} });
    expect(result).toEqual({ ok: false, error: "No changes supplied" });
  });
});

describe("reprocessTool", () => {
  async function seedLinkedTool(): Promise<string> {
    const [source] = await db
      .insert(s.sources)
      .values({
        name: "Fixture",
        slug: `fixture-${Date.now()}-${Math.random()}`,
        type: "manual",
        adapterKey: "fixture:inline",
      })
      .returning();
    const toolId = await seedTool("draft");
    const item: NormalizedItem = {
      sourceItemId: "item-1",
      name: "أداة تجريبية",
      slug: "tool-fixture",
      websiteUrl: "https://example.com",
      domain: "example.com",
      summary: "ملخص",
      contentText: "نص المحتوى",
      publishedAt: null,
      normalizedName: "اداه تجريبيه",
      contentHash: "hash",
      categorySlug: null,
    };
    await db.insert(s.toolSources).values({
      toolId,
      sourceId: source.id,
      sourceItemId: "item-1",
      normalizedData: item as unknown as Record<string, unknown>,
    });
    return toolId;
  }

  it("requires an authenticated actor", async () => {
    const toolId = await seedLinkedTool();
    await expect(
      reprocessTool({ actor: null, toolId, provider: scriptedProvider("{}") }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("fails when the tool has no stored source data", async () => {
    const toolId = await seedTool();
    const result = await reprocessTool({
      actor: admin,
      toolId,
      provider: scriptedProvider("{}"),
    });
    expect(result).toEqual({
      ok: false,
      error: "No stored source data for this tool",
    });
  });

  it("re-enriches a tool from its stored source data", async () => {
    const toolId = await seedLinkedTool();
    const [category] = await db
      .insert(s.categories)
      .values({
        nameAr: "الإنتاجية",
        nameEn: "Productivity",
        slug: "ai-productivity",
      })
      .returning();

    const result = await reprocessTool({
      actor: admin,
      toolId,
      provider: scriptedProvider(JSON.stringify(validEnrichment())),
    });
    expect(result.ok).toBe(true);

    const [tool] = await db
      .select()
      .from(s.tools)
      .where(eq(s.tools.id, toolId));
    expect(tool.descriptionAr.length).toBeGreaterThan(40);
    expect(tool.status).toBe("published");
    expect(tool.categoryId).toBe(category.id);
  });
});

describe("setUpdateStatus", () => {
  async function seedUpdate(
    status: (typeof s.contentStatus.enumValues)[number] = "draft",
  ): Promise<{ updateId: string; toolId: string }> {
    const toolId = await seedTool();
    const [update] = await db
      .insert(s.updates)
      .values({
        toolId,
        title: "تحديث مكتشف",
        contentAr: "محتوى محدّث من المصدر",
        sourceUrl: `https://example.com/updates/${Date.now()}`,
        status,
      })
      .returning();
    return { updateId: update.id, toolId };
  }

  it("requires an authenticated actor", async () => {
    const { updateId } = await seedUpdate();
    await expect(
      setUpdateStatus({ actor: null, updateId, to: "published" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("reports a missing update instead of throwing", async () => {
    const result = await setUpdateStatus({
      actor: admin,
      updateId: "00000000-0000-0000-0000-0000000000ff",
      to: "published",
    });
    expect(result.ok).toBe(false);
  });

  it("publishes a detected update and records a revision on the tool", async () => {
    const { updateId, toolId } = await seedUpdate();
    const result = await setUpdateStatus({ actor: editor, updateId, to: "published" });
    expect(result.ok).toBe(true);

    const [update] = await db
      .select()
      .from(s.updates)
      .where(eq(s.updates.id, updateId));
    expect(update.status).toBe("published");

    const revisions = await db
      .select()
      .from(s.contentRevisions)
      .where(eq(s.contentRevisions.entityId, toolId));
    expect(revisions.some((row) => row.field === "update.status")).toBe(true);
  });

  it("refuses invalid transitions and unknown targets", async () => {
    const { updateId } = await seedUpdate("published");
    const invalid = await setUpdateStatus({ actor: editor, updateId, to: "approved" });
    expect(invalid.ok).toBe(false);

    const noop = await setUpdateStatus({ actor: editor, updateId, to: "published" });
    expect(noop.ok).toBe(true);
  });
});
