import { eq } from "drizzle-orm";
import { requireActor, type Actor } from "@/lib/auth/authorization";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import type { NotificationProviderSet } from "@/lib/notifications/types";

export type ModelStatusValue = (typeof s.contentStatus.enumValues)[number];

export interface ModelStatusResult {
  ok: boolean;
  status?: ModelStatusValue;
  error?: string;
  notified?: { triggered: boolean; reason?: string; failed?: number };
}

export const MODEL_STATUS_TRANSITIONS: Record<
  ModelStatusValue,
  ModelStatusValue[]
> = {
  draft: ["pending_review", "approved", "published", "rejected"],
  pending_review: ["approved", "published", "rejected"],
  approved: ["published", "pending_review", "rejected"],
  published: ["pending_review", "rejected"],
  rejected: ["draft", "pending_review"],
};

export function canTransitionModel(
  from: ModelStatusValue,
  to: ModelStatusValue,
): boolean {
  if (from === to) return true;
  return MODEL_STATUS_TRANSITIONS[from].includes(to);
}

function assertEditor(actor: Actor): void {
  if (actor.role !== "admin" && actor.role !== "editor") {
    throw new Error("Only editors and admins can review model content");
  }
}

/**
 * Review action for model catalog rows: admin/editor gates the visibility of a
 * model card (only `published` rows appear on the public /models listing).
 */
export async function transitionModelStatus(args: {
  actor: unknown;
  modelId: string;
  to: ModelStatusValue;
  database?: Db;
  reason?: "admin" | "edit";
}): Promise<ModelStatusResult> {
  const actor = requireActor(args.actor);
  assertEditor(actor);
  const database = args.database ?? defaultDb;

  const [model] = await database
    .select()
    .from(s.models)
    .where(eq(s.models.id, args.modelId))
    .limit(1);
  if (!model) return { ok: false, error: "Model not found" };

  if (model.status === args.to) return { ok: true, status: model.status };
  if (!canTransitionModel(model.status, args.to)) {
    return {
      ok: false,
      error: `Invalid transition: ${model.status} -> ${args.to}`,
    };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(s.models)
      .set({
        status: args.to,
        publishedAt: args.to === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(s.models.id, args.modelId));

    await tx.insert(s.contentRevisions).values({
      entityType: "model",
      entityId: args.modelId,
      field: "status",
      before: { status: model.status },
      after: { status: args.to },
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  return { ok: true, status: args.to };
}

/**
 * Human review of a detected model change. `published` gates public
 * visibility and triggers the change-notification dispatch (one event per
 * update; re-pubblications never re-notify).
 */
export async function setModelUpdateStatus(args: {
  actor: unknown;
  modelUpdateId: string;
  to: ModelStatusValue;
  database?: Db;
  reason?: "admin" | "edit";
  notify?: boolean;
  providersOverride?: NotificationProviderSet;
}): Promise<ModelStatusResult> {
  const actor = requireActor(args.actor);
  assertEditor(actor);
  const database = args.database ?? defaultDb;

  const [update] = await database
    .select()
    .from(s.modelUpdates)
    .where(eq(s.modelUpdates.id, args.modelUpdateId))
    .limit(1);
  if (!update) return { ok: false, error: "Model update not found" };

  if (update.status === args.to) {
    return { ok: true, status: update.status };
  }
  if (!canTransitionModel(update.status, args.to)) {
    return {
      ok: false,
      error: `Invalid transition: ${update.status} -> ${args.to}`,
    };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(s.modelUpdates)
      .set({
        status: args.to,
        publishedAt: args.to === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(s.modelUpdates.id, args.modelUpdateId));

    await tx.insert(s.contentRevisions).values({
      entityType: "model",
      entityId: update.modelId,
      field: "model_update.status",
      before: { modelUpdateId: update.id, status: update.status },
      after: { modelUpdateId: update.id, status: args.to },
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  let notified: ModelStatusResult["notified"];
  if (args.to === "published" && (args.notify ?? true)) {
    const service = await import("@/lib/notifications/service");
    const providers =
      args.providersOverride ??
      (await service.createNotificationProvidersFromEnv());
    const result = await service.triggerNotificationsForPublishedUpdate(
      args.modelUpdateId,
      providers,
      database,
    );
    notified = result.triggered
      ? { triggered: true, failed: result.summary.failed }
      : { triggered: false, reason: result.reason };
  }

  return { ok: true, status: args.to, notified };
}

/** Manual facts adjustment for a catalog model (admin curation). */
export async function updateModelFields(args: {
  actor: unknown;
  modelId: string;
  fields: {
    name?: string;
    providerId?: string | null;
    modelIdentifier?: string;
    releaseDate?: string | null;
    currentVersion?: string | null;
    isDownloadable?: boolean;
    contextWindow?: number | null;
    inputPricePer1M?: string | number | null;
    outputPricePer1M?: string | number | null;
    pricingNotes?: string | null;
    modalities?: string[];
    websiteUrl?: string | null;
    descriptionAr?: string;
    descriptionEn?: string;
  };
  database?: Db;
  reason?: "admin" | "edit";
}): Promise<ModelStatusResult> {
  const actor = requireActor(args.actor);
  assertEditor(actor);
  const database = args.database ?? defaultDb;

  const [model] = await database
    .select()
    .from(s.models)
    .where(eq(s.models.id, args.modelId))
    .limit(1);
  if (!model) return { ok: false, error: "Model not found" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(args.fields)) {
    if (value !== undefined) patch[key] = value;
  }
  if (Object.keys(patch).length <= 1) {
    return { ok: false, error: "No changes supplied" };
  }

  await database.transaction(async (tx) => {
    await tx.update(s.models).set(patch).where(eq(s.models.id, args.modelId));
    await tx.insert(s.contentRevisions).values({
      entityType: "model",
      entityId: args.modelId,
      field: "fields",
      before: {
        name: model.name,
        providerId: model.providerId,
        modelIdentifier: model.modelIdentifier,
        releaseDate: model.releaseDate,
        currentVersion: model.currentVersion,
        isDownloadable: model.isDownloadable,
        contextWindow: model.contextWindow,
        inputPricePer1M: model.inputPricePer1M,
        outputPricePer1M: model.outputPricePer1M,
        pricingNotes: model.pricingNotes,
        modalities: model.modalities,
        websiteUrl: model.websiteUrl,
        descriptionAr: model.descriptionAr,
        descriptionEn: model.descriptionEn,
      },
      after: patch,
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  return { ok: true };
}