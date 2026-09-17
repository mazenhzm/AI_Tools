import { desc, eq } from "drizzle-orm";
import { createEnricher, createProviderFromEnv } from "@/lib/ai/enrich";
import type { AiProvider } from "@/lib/ai/provider";
import { requireActor, type Actor } from "@/lib/auth/authorization";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import type { NormalizedItem } from "@/ingestion/types";

export type ToolStatusValue = (typeof s.toolStatus.enumValues)[number];

/**
 * Allowed status transitions for human review. Anything not listed here is
 * rejected so a bug or a crafted request cannot move a tool into an unexpected
 * state (e.g. published -> draft without review).
 */
export const TOOL_STATUS_TRANSITIONS: Record<
  ToolStatusValue,
  ToolStatusValue[]
> = {
  draft: [
    "ai_processed",
    "pending_review",
    "approved",
    "rejected",
    "archived",
  ],
  ai_processed: [
    "pending_review",
    "approved",
    "published",
    "rejected",
    "archived",
  ],
  pending_review: ["approved", "published", "rejected", "archived"],
  approved: ["published", "pending_review", "rejected", "archived"],
  published: ["pending_review", "archived"],
  rejected: ["pending_review", "draft", "archived"],
  archived: ["pending_review", "draft"],
};

export function canTransitionTool(
  from: ToolStatusValue,
  to: ToolStatusValue,
): boolean {
  if (from === to) return true;
  return TOOL_STATUS_TRANSITIONS[from].includes(to);
}

export interface ServiceResult {
  ok: boolean;
  status?: ToolStatusValue;
  error?: string;
}

function assertStatusTargetAllowed(actor: Actor, to: ToolStatusValue): void {
  if (to === "archived" && actor.role !== "admin") {
    throw new Error("Only admins can archive tools");
  }
}

export async function transitionToolStatus(args: {
  actor: unknown;
  toolId: string;
  to: ToolStatusValue;
  database?: Db;
  reason?: "admin" | "edit" | "ai_update" | "ai_create" | "ingestion";
}): Promise<ServiceResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;
  assertStatusTargetAllowed(actor, args.to);

  const [tool] = await database
    .select()
    .from(s.tools)
    .where(eq(s.tools.id, args.toolId))
    .limit(1);
  if (!tool) return { ok: false, error: "Tool not found" };

  const from = tool.status;
  if (from === args.to) return { ok: true, status: from };

  if (!canTransitionTool(from, args.to)) {
    return {
      ok: false,
      error: `Invalid transition: ${from} -> ${args.to}`,
    };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(s.tools)
      .set({
        status: args.to,
        publishedAt: args.to === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(s.tools.id, args.toolId));

    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: args.toolId,
      field: "status",
      before: { status: from },
      after: { status: args.to },
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  return { ok: true, status: args.to };
}

export async function reprocessTool(args: {
  actor: unknown;
  toolId: string;
  database?: Db;
  provider?: AiProvider;
}): Promise<ServiceResult> {
  requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [link] = await database
    .select()
    .from(s.toolSources)
    .where(eq(s.toolSources.toolId, args.toolId))
    .orderBy(desc(s.toolSources.lastSeenAt))
    .limit(1);
  if (!link) {
    return { ok: false, error: "No stored source data for this tool" };
  }

  const [source] = await database
    .select()
    .from(s.sources)
    .where(eq(s.sources.id, link.sourceId))
    .limit(1);
  const item = link.normalizedData as unknown as NormalizedItem | null;
  if (!source || !item || typeof item.name !== "string") {
    return { ok: false, error: "Stored source data is incomplete" };
  }

  const provider = args.provider ?? createProviderFromEnv();
  if (!provider) {
    return { ok: false, error: "AI disabled: GEMINI_API_KEY is not set" };
  }

  const [ingestionItem] = await database
    .select({ id: s.ingestionItems.id })
    .from(s.ingestionItems)
    .where(eq(s.ingestionItems.toolId, args.toolId))
    .orderBy(desc(s.ingestionItems.createdAt))
    .limit(1);

  const enrich = createEnricher({ provider, database });
  const result = await enrich({
    toolId: args.toolId,
    item,
    source,
    ingestionItemId: ingestionItem?.id ?? null,
  });

  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "AI reprocessing failed" };
}

export async function updateToolFields(args: {
  actor: unknown;
  toolId: string;
  fields: {
    name?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    pricingType?: (typeof s.pricingType.enumValues)[number];
    websiteUrl?: string | null;
    categoryId?: string | null;
  };
  database?: Db;
  reason?: "admin" | "edit";
}): Promise<ServiceResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [tool] = await database
    .select()
    .from(s.tools)
    .where(eq(s.tools.id, args.toolId))
    .limit(1);
  if (!tool) return { ok: false, error: "Tool not found" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(args.fields)) {
    if (value !== undefined) patch[key] = value;
  }
  if (Object.keys(patch).length <= 1) {
    return { ok: false, error: "No changes supplied" };
  }

  await database.transaction(async (tx) => {
    await tx.update(s.tools).set(patch).where(eq(s.tools.id, args.toolId));
    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: args.toolId,
      field: "fields",
      before: {
        name: tool.name,
        descriptionAr: tool.descriptionAr,
        descriptionEn: tool.descriptionEn,
        pricingType: tool.pricingType,
        websiteUrl: tool.websiteUrl,
        categoryId: tool.categoryId,
      },
      after: patch,
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  return { ok: true };
}

export type UpdateStatusValue = (typeof s.contentStatus.enumValues)[number];

const UPDATE_STATUS_TRANSITIONS: Record<
  UpdateStatusValue,
  UpdateStatusValue[]
> = {
  draft: ["pending_review", "approved", "published", "rejected"],
  pending_review: ["approved", "published", "rejected"],
  approved: ["published", "rejected", "pending_review"],
  published: ["rejected", "pending_review"],
  rejected: ["draft", "pending_review"],
};

/**
 * Review action for monitored tool updates: an editor approves/rejects a
 * detected change. Only `published` updates are visible on the public tool
 * page, so this is the gate that keeps unreviewed source changes private.
 */
export async function setUpdateStatus(args: {
  actor: unknown;
  updateId: string;
  to: UpdateStatusValue;
  database?: Db;
  reason?: "admin" | "edit";
}): Promise<ServiceResult> {
  const actor = requireActor(args.actor);
  const database = args.database ?? defaultDb;

  const [update] = await database
    .select()
    .from(s.updates)
    .where(eq(s.updates.id, args.updateId))
    .limit(1);
  if (!update) return { ok: false, error: "Update not found" };

  if (update.status === args.to) return { ok: true };
  if (!UPDATE_STATUS_TRANSITIONS[update.status].includes(args.to)) {
    return {
      ok: false,
      error: `Invalid transition: ${update.status} -> ${args.to}`,
    };
  }

  await database.transaction(async (tx) => {
    await tx
      .update(s.updates)
      .set({ status: args.to, updatedAt: new Date() })
      .where(eq(s.updates.id, args.updateId));

    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: update.toolId,
      field: "update.status",
      before: { updateId: update.id, status: update.status },
      after: { updateId: update.id, status: args.to },
      reason: args.reason ?? "admin",
      editorId: actor.id,
    });
  });

  return { ok: true };
}
