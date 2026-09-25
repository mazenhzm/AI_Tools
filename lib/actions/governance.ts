"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  dismissFieldConflict,
  resolveFieldConflict,
  type ConflictResolution,
} from "@/lib/services/conflicts";

async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

function toMessage(value: string): string {
  return encodeURIComponent(value);
}

const BACK = "/admin/governance";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const RESOLUTIONS: ConflictResolution[] = ["a", "b", "stored"];

/**
 * Adopt one of the two proposed source values (or the currently stored value)
 * for a contested field. Writes the decision to the model row + a content
 * revision, then closes the open conflict. Conflicts are never auto-resolved.
 */
export async function resolveFieldConflictAction(
  formData: FormData,
): Promise<void> {
  const conflictId = String(formData.get("conflictId") ?? "");
  const resolution = String(formData.get("resolution") ?? "");
  if (
    !isUuid(conflictId) ||
    !(RESOLUTIONS as string[]).includes(resolution)
  ) {
    redirect(`${BACK}?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    if (!user) throw new AuthorizationError("Authentication required");
    const result = await resolveFieldConflict({
      actor: user,
      conflictId,
      resolution: resolution as ConflictResolution,
    });
    revalidatePath(BACK);
    const message = result.ok
      ? "تم اعتماد القيمة وحُفظ التعديل في سجل المراجعات"
      : (result.error ?? "تعذر حل النزاع");
    redirect(`${BACK}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

/** Archive an open conflict without changing the entity row. */
export async function dismissFieldConflictAction(
  formData: FormData,
): Promise<void> {
  const conflictId = String(formData.get("conflictId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(conflictId)) {
    redirect(`${BACK}?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    if (!user) throw new AuthorizationError("Authentication required");
    const result = await dismissFieldConflict({
      actor: user,
      conflictId,
      reason: reason || undefined,
    });
    revalidatePath(BACK);
    const message = result.ok
      ? "تم تجاهل النزاع وأُرشفت الحالة"
      : (result.error ?? "تعذر تجاهل النزاع");
    redirect(`${BACK}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}