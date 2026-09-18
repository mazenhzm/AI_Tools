import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import {
  canTransitionModel,
  setModelUpdateStatus,
  transitionModelStatus,
  updateModelFields,
} from "@/lib/services/model-review";
import type { NotificationProviderSet } from "@/lib/notifications/types";
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
const visitor = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "visitor@example.com",
  role: "user" as const,
};

const noOpProviders: NotificationProviderSet = { email: null, telegram: null };

async function seedModel(
  status: (typeof s.contentStatus.enumValues)[number] = "draft",
): Promise<typeof s.models.$inferSelect> {
  const [row] = await db
    .insert(s.models)
    .values({
      name: "نموذج تجريبي",
      slug: `model-${Date.now()}-${Math.random()}`,
      modelIdentifier: `mid-${Math.random()}`,
      status,
      modalities: ["text"],
    })
    .returning();
  return row;
}

async function seedUpdate(modelId: string): Promise<typeof s.modelUpdates.$inferSelect> {
  const [row] = await db
    .insert(s.modelUpdates)
    .values({
      modelId,
      kind: "context_window",
      title: "نافذة السياق: 1024 → 4096",
      contentAr: "ارتفعت نافذة السياق",
      sourceUrl: `https://sample.example.com/updates/${Math.random()}`,
      status: "draft",
    })
    .returning();
  return row;
}

beforeEach(async () => {
  await clearDb();
  await db.insert(s.administrators).values([
    { id: admin.id, email: admin.email, passwordHash: "test", role: "admin" },
    { id: editor.id, email: editor.email, passwordHash: "test", role: "editor" },
  ]);
});

describe("canTransitionModel", () => {
  it("follows documented transitions only", () => {
    expect(canTransitionModel("draft", "published")).toBe(true);
    expect(canTransitionModel("published", "draft")).toBe(false);
    expect(canTransitionModel("published", "published")).toBe(true);
    expect(canTransitionModel("rejected", "draft")).toBe(true);
  });
});

describe("transitionModelStatus", () => {
  it("requires an authenticated editor/admin", async () => {
    const model = await seedModel();
    await expect(
      transitionModelStatus({ actor: null, modelId: model.id, to: "published" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("refuses non-editor roles", async () => {
    const model = await seedModel();
    await expect(
      transitionModelStatus({ actor: visitor, modelId: model.id, to: "published" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("publishes a model and stamps publishedAt", async () => {
    const model = await seedModel("approved");
    const result = await transitionModelStatus({
      actor: admin,
      modelId: model.id,
      to: "published",
    });
    expect(result.ok).toBe(true);

    const [updated] = await db
      .select()
      .from(s.models)
      .where(eq(s.models.id, model.id));
    expect(updated.status).toBe("published");
    expect(updated.publishedAt).toBeInstanceOf(Date);

    const revisions = await db
      .select()
      .from(s.contentRevisions)
      .where(eq(s.contentRevisions.entityId, model.id));
    expect(revisions.length).toBeGreaterThan(0);
  });

  it("refuses an invalid transition", async () => {
    const model = await seedModel("published");
    const result = await transitionModelStatus({
      actor: editor,
      modelId: model.id,
      to: "draft",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid transition");
  });
});

describe("setModelUpdateStatus", () => {
  it("publishing a draft update makes it public and triggers a dispatch", async () => {
    const model = await seedModel("published");
    const update = await seedUpdate(model.id);

    const result = await setModelUpdateStatus({
      actor: admin,
      modelUpdateId: update.id,
      to: "published",
      providersOverride: noOpProviders,
    });
    expect(result.ok).toBe(true);
    expect(result.notified?.triggered).toBe(true);

    const [published] = await db
      .select()
      .from(s.modelUpdates)
      .where(eq(s.modelUpdates.id, update.id));
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeInstanceOf(Date);

    const events = await db.select().from(s.notificationEvents);
    expect(events).toHaveLength(1);
  });

  it("never re-notifies a re-published update (one event per update)", async () => {
    const model = await seedModel("published");
    const update = await seedUpdate(model.id);

    const first = await setModelUpdateStatus({
      actor: admin,
      modelUpdateId: update.id,
      to: "published",
      providersOverride: noOpProviders,
    });
    expect(first.notified?.triggered).toBe(true);

    // published -> pending_review -> published exercises the already-processed guard.
    await setModelUpdateStatus({
      actor: admin,
      modelUpdateId: update.id,
      to: "pending_review",
      providersOverride: noOpProviders,
    });
    const republish = await setModelUpdateStatus({
      actor: admin,
      modelUpdateId: update.id,
      to: "published",
      providersOverride: noOpProviders,
    });
    expect(republish.ok).toBe(true);
    expect(republish.notified?.triggered).toBe(false);

    expect((await db.select().from(s.notificationEvents)).length).toBe(1);
  });
});

describe("updateModelFields", () => {
  it("persists curated facts and records a content revision", async () => {
    const model = await seedModel();
    const result = await updateModelFields({
      actor: admin,
      modelId: model.id,
      fields: { contextWindow: 32000, descriptionAr: "وصف منسّق" },
    });
    expect(result.ok).toBe(true);

    const [updated] = await db
      .select()
      .from(s.models)
      .where(eq(s.models.id, model.id));
    expect(updated.contextWindow).toBe(32000);
    expect(updated.descriptionAr).toBe("وصف منسّق");

    const revisions = await db
      .select()
      .from(s.contentRevisions)
      .where(eq(s.contentRevisions.entityId, model.id));
    expect(revisions[0].field).toBe("fields");
  });

  it("requires at least one actual change", async () => {
    const model = await seedModel();
    const result = await updateModelFields({
      actor: admin,
      modelId: model.id,
      fields: {},
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No changes");
  });
});