"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { isContentStatus } from "@/lib/db/queries/admin";
import {
  setModelUpdateStatus,
  transitionModelStatus,
  updateModelFields,
  type ModelStatusValue,
} from "@/lib/services/model-review";

async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

function toMessage(value: string): string {
  return encodeURIComponent(value);
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ---------------------------------------------------------------------------
// Admin: model review
// ---------------------------------------------------------------------------

export async function setModelStatusAction(formData: FormData): Promise<void> {
  const modelId = String(formData.get("modelId") ?? "");
  const rawStatus = String(formData.get("to") ?? "");
  if (!modelId || !isContentStatus(rawStatus)) {
    redirect(`/admin/models?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    const result = await transitionModelStatus({
      actor: user,
      modelId,
      to: rawStatus as ModelStatusValue,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/models");
    revalidatePath(`/admin/models/${modelId}`);
    revalidatePath(`/models/${(await modelSlug(modelId)) ?? ""}`);
    const message = result.ok ? "تم تحديث حالة النموذج" : (result.error ?? "تعذر التحديث");
    redirect(`/admin/models/${modelId}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function setModelUpdateStatusAction(
  formData: FormData,
): Promise<void> {
  const modelId = String(formData.get("modelId") ?? "");
  const updateId = String(formData.get("updateId") ?? "");
  const rawStatus = String(formData.get("to") ?? "");
  const target = `/admin/models/${modelId}`;

  if (!modelId || !updateId || !isContentStatus(rawStatus)) {
    redirect(`${target}?message=${toMessage("طلب غير صالح")}`);
  }

  const user = await currentUser();
  try {
    const result = await setModelUpdateStatus({
      actor: user,
      modelUpdateId: updateId,
      to: rawStatus as ModelStatusValue,
    });
    revalidatePath(target);
    revalidatePath(`/models/${(await modelSlug(modelId)) ?? ""}`);
    const base = result.ok ? "تم تحديث حالة التحديث" : (result.error ?? "تعذر التحديث");
    const message = result.notified
      ? result.notified.triggered
        ? result.notified.failed && result.notified.failed > 0
          ? `${base} — أُرسلت بعض الإشعارات وفشل بعضها`
          : `${base} — أُرسلت الإشعارات`
        : `${base} — (بلا إشعارات، التحديث أُرسل سابقاً)`
      : base;
    redirect(`${target}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function updateModelFieldsAction(
  formData: FormData,
): Promise<void> {
  const modelId = String(formData.get("modelId") ?? "");
  const target = `/admin/models/${modelId}`;
  if (!isUuid(modelId)) redirect(`${target}?message=${toMessage("طلب غير صالح")}`);

  const patch: Record<string, unknown> = {};
  const text = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value.length > 0 ? value : null;
  };

  const contractWindowRaw = String(formData.get("contextWindow") ?? "").trim();
  const inputPrice = String(formData.get("inputPricePer1M") ?? "").trim();
  const outputPrice = String(formData.get("outputPricePer1M") ?? "").trim();

  patch.name = text("name") ?? undefined;
  patch.modelIdentifier = text("modelIdentifier") ?? undefined;
  patch.currentVersion = text("currentVersion") ?? undefined;
  patch.pricingNotes = text("pricingNotes") ?? undefined;
  patch.websiteUrl = text("websiteUrl") ?? undefined;
  patch.descriptionAr = String(formData.get("descriptionAr") ?? "").trim() || undefined;
  patch.descriptionEn = String(formData.get("descriptionEn") ?? "").trim() || undefined;
  const releaseDate = text("releaseDate");
  patch.releaseDate =
    releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : undefined;
  patch.isDownloadable = formData.get("isDownloadable") === "1";
  const contextRaw = contractWindowRaw;
  patch.contextWindow =
    contextRaw.length > 0 && Number.isFinite(Number(contextRaw)) && Number(contextRaw) > 0
      ? Number(contextRaw)
      : undefined;
  const parsePrice = (value: string) =>
    value.length === 0
      ? null
      : Number.isFinite(Number(value)) && Number(value) >= 0
        ? String(Number(value))
        : null;
  patch.inputPricePer1M = parsePrice(inputPrice);
  patch.outputPricePer1M = parsePrice(outputPrice);
  patch.modalities = String(formData.get("modalities") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  const user = await currentUser();
  try {
    const result = await updateModelFields({
      actor: user,
      modelId,
      fields: patch as Parameters<typeof updateModelFields>[0]["fields"],
    });
    revalidatePath(target);
    revalidatePath("/admin/models");
    revalidatePath(`/models/${(await modelSlug(modelId)) ?? ""}`);
    const message = result.ok ? "تم تحديث بيانات النموذج" : (result.error ?? "تعذر التحديث");
    redirect(`${target}?message=${toMessage(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

async function modelSlug(modelId: string): Promise<string | null> {
  const [model] = await db
    .select({ slug: s.models.slug })
    .from(s.models)
    .where(eq(s.models.id, modelId))
    .limit(1);
  return model?.slug ?? null;
}