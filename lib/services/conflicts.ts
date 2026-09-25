import { eq } from "drizzle-orm";
import { requireActor, type Actor } from "@/lib/auth/authorization";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";

export type ConflictResolution = "a" | "b" | "stored";

export interface ConflictResolutionResult {
  ok: boolean;
  error?: string;
}

function assertEditor(actor: Actor): void {
  if (actor.role !== "admin" && actor.role !== "editor") {
    throw new Error("Only editors and admins can resolve field conflicts");
  }
}

/** Cross-source field conflicts are never auto-resolved by the agent. */
export async function resolveFieldConflict(args: {
  actor: unknown;
  conflictId: string;
  resolution: ConflictResolution;
  database?: Db;
}): Promise<ConflictResolutionResult> {
  const actor = requireActor(args.actor);
  assertEditor(actor);
  const database = args.database ?? defaultDb;

  const [conflict] = await database
    .select()
    .from(s.fieldConflicts)
    .where(eq(s.fieldConflicts.id, args.conflictId))
    .limit(1);
  if (!conflict) return { ok: false, error: "Conflict not found" };
  if (conflict.status !== "open") {
    return { ok: false, error: "Conflict is already handled" };
  }

  const chosen =
    args.resolution === "a"
      ? conflict.valueA
      : args.resolution === "b"
        ? conflict.valueB
        : conflict.storedValue;

  await database.transaction(async (tx) => {
    // Apply the chosen value to the entity row (recorded + reversible).
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    patch[conflict.field] = chosen;
    await tx
      .update(s.models)
      .set(patch)
      .where(eq(s.models.id, conflict.entityId));

    await tx
      .update(s.fieldConflicts)
      .set({
        status: "resolved",
        resolution: args.resolution,
        resolvedValue: chosen,
        editorId: actor.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(s.fieldConflicts.id, conflict.id));

    await tx.insert(s.contentRevisions).values({
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      field: conflict.field,
      before: {
        value: conflict.storedValue,
        sourceA: {
          sourceId: conflict.sourceAId,
          value: conflict.valueA,
        },
        sourceB: {
          sourceId: conflict.sourceBId,
          value: conflict.valueB,
        },
      },
      after: { value: chosen, resolution: args.resolution },
      reason: "admin",
      editorId: actor.id,
    });
  });

  return { ok: true };
}

/**
 * Marks an open conflict as dismissed without changing the entity row. The
 * disagreement is acknowledged and archived; the current value stays.
 */
export async function dismissFieldConflict(args: {
  actor: unknown;
  conflictId: string;
  reason?: string;
  database?: Db;
}): Promise<ConflictResolutionResult> {
  const actor = requireActor(args.actor);
  assertEditor(actor);
  const database = args.database ?? defaultDb;

  const [conflict] = await database
    .select()
    .from(s.fieldConflicts)
    .where(eq(s.fieldConflicts.id, args.conflictId))
    .limit(1);
  if (!conflict) return { ok: false, error: "Conflict not found" };
  if (conflict.status !== "open") {
    return { ok: false, error: "Conflict is already handled" };
  }

  await database
    .update(s.fieldConflicts)
    .set({
      status: "dismissed",
      resolution: args.reason?.trim() || "dismissed",
      editorId: actor.id,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(s.fieldConflicts.id, conflict.id));

  return { ok: true };
}