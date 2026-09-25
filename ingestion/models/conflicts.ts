import { and, eq, ne } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { comparable, type ModelChange } from "./update-monitor";

export interface RecordConflictsInput {
  modelId: string;
  sourceId: string;
  changes: ModelChange[];
  database?: Db;
}

/**
 * Records an OPEN cross-source conflict whenever a detected factual change
 * disagrees with another source's recorded value for the same field. Conflicts
 * are never auto-resolved — an editor decides in the governance queue.
 *
 * Idempotency: the partial unique index (entity, field, sourceA, sourceB)
 * WHERE status = 'open' prevents duplicate open conflict rows.
 */
export async function recordModelFieldConflicts(
  input: RecordConflictsInput,
): Promise<number> {
  const database = input.database ?? defaultDb;
  const others = await database
    .select()
    .from(s.modelSources)
    .where(
      and(
        eq(s.modelSources.modelId, input.modelId),
        ne(s.modelSources.sourceId, input.sourceId),
      ),
    );
  if (others.length === 0) return 0;

  const [model] = await database
    .select()
    .from(s.models)
    .where(eq(s.models.id, input.modelId))
    .limit(1);

  let recorded = 0;
  for (const change of input.changes) {
    if (comparable(change.after) === comparable(change.before)) continue;
    for (const other of others) {
      const normalized = other.normalizedData as Record<string, unknown> | null;
      if (!normalized || !(change.field in normalized)) continue;
      const valueB = normalized[change.field];
      // Sources agree with each other → no conflict to record.
      if (comparable(valueB) === comparable(change.after)) continue;
      try {
        await database
          .insert(s.fieldConflicts)
          .values({
            entityType: "model",
            entityId: input.modelId,
            field: change.field,
            storedValue: model ? (model as Record<string, unknown>)[change.field] : null,
            valueA: change.after,
            valueB,
            sourceAId: input.sourceId,
            sourceBId: other.sourceId,
            status: "open",
          })
          .onConflictDoNothing();
        recorded += 1;
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }
  return recorded;
}