"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  reprocessTool,
  setUpdateStatus,
  transitionToolStatus,
  type ToolStatusValue,
  type UpdateStatusValue,
} from "@/lib/services/review";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { isContentStatus, isToolStatus } from "@/lib/db/queries/admin";
import { eq } from "drizzle-orm";

async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

function toMessage(value: string): string {
  return encodeURIComponent(value);
}

export async function setToolStatusAction(formData: FormData): Promise<void> {
  const toolId = String(formData.get("toolId") ?? "");
  const rawStatus = String(formData.get("to") ?? "");
  if (!toolId || !isToolStatus(rawStatus)) {
    redirect(`/admin/tools?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    const result = await transitionToolStatus({
      actor: user,
      toolId,
      to: rawStatus as ToolStatusValue,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/tools");
    revalidatePath(`/admin/tools/${toolId}`);
    const message = result.ok
      ? `تم تحديث الحالة إلى ${result.status}`
      : (result.error ?? "تعذر تحديث الحالة");
    redirect(`/admin/tools/${toolId}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/admin/login");
    }
    throw error;
  }
}

export async function reprocessToolAction(formData: FormData): Promise<void> {
  const toolId = String(formData.get("toolId") ?? "");
  if (!toolId) redirect(`/admin/tools?message=${toMessage("طلب غير صالح")}`);

  const user = await currentUser();
  try {
    const result = await reprocessTool({ actor: user, toolId });
    revalidatePath("/admin");
    revalidatePath("/admin/tools");
    revalidatePath(`/admin/tools/${toolId}`);
    const message = result.ok
      ? "تمت إعادة المعالجة بالذكاء الاصطناعي"
      : (result.error ?? "تعذرت إعادة المعالجة");
    redirect(`/admin/tools/${toolId}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/admin/login");
    }
    throw error;
  }
}

export async function setUpdateStatusAction(formData: FormData): Promise<void> {
  const toolId = String(formData.get("toolId") ?? "");
  const updateId = String(formData.get("updateId") ?? "");
  const rawStatus = String(formData.get("to") ?? "");
  const target = `/admin/tools/${toolId}`;

  if (!toolId || !updateId || !isContentStatus(rawStatus)) {
    redirect(`${target}?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    const result = await setUpdateStatus({
      actor: user,
      updateId,
      to: rawStatus as UpdateStatusValue,
    });
    revalidatePath(target);
    const message = result.ok ? "تم تحديث حالة التحديث" : (result.error ?? "تعذر التحديث");
    redirect(`${target}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/admin/login");
    }
    throw error;
  }
}

export async function toggleSourceActiveAction(
  formData: FormData,
): Promise<void> {
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) redirect(`/admin/sources?message=${toMessage("طلب غير صالح")}`);

  const user = await currentUser();
  try {
    if (!user) throw new AuthorizationError("Authentication required");
    const [source] = await db
      .select()
      .from(s.sources)
      .where(eq(s.sources.id, sourceId))
      .limit(1);
    if (!source) {
      redirect(`/admin/sources?message=${toMessage("المصدر غير موجود")}`);
    }
    await db
      .update(s.sources)
      .set({ active: !source.active, updatedAt: new Date() })
      .where(eq(s.sources.id, sourceId));
    revalidatePath("/admin/sources");
    redirect(
      `/admin/sources?message=${toMessage(
        source.active ? "تم إيقاف المصدر" : "تم تشغيل المصدر",
      )}`,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}
