"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  isCampaignStatus,
  setSponsoredStatus,
  setToolAffiliateUrl,
  setToolFeatured,
  upsertSponsoredListing,
} from "@/lib/services/monetization";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function message(value: string): string {
  return encodeURIComponent(value);
}

async function actorOrRedirect(): Promise<unknown> {
  const user = (await auth())?.user ?? null;
  if (!user) redirect("/admin/login");
  return user;
}

export async function setFeaturedAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  const toolId = text(formData, "toolId");
  try {
    const result = await setToolFeatured({
      actor: user,
      toolId,
      featured: text(formData, "featured") === "true",
    });
    revalidatePath(`/admin/tools/${toolId}`);
    redirect(
      `/admin/tools/${toolId}?message=${message(
        result.ok ? "تم تحديث حالة التمييز" : (result.error ?? "فشل الإجراء"),
      )}`,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function setAffiliateAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  const toolId = text(formData, "toolId");
  try {
    const result = await setToolAffiliateUrl({
      actor: user,
      toolId,
      affiliateUrl: text(formData, "affiliateUrl") || null,
    });
    revalidatePath(`/admin/tools/${toolId}`);
    redirect(
      `/admin/tools/${toolId}?message=${message(
        result.ok ? "تم تحديث رابط العمولة" : (result.error ?? "فشل الإجراء"),
      )}`,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function saveSponsoredAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  const toolId = text(formData, "toolId");
  const listingId = text(formData, "listingId");
  const campaignStatus = text(formData, "campaignStatus");
  try {
    const result = await upsertSponsoredListing({
      actor: user,
      listingId: listingId || undefined,
      toolId,
      placement: text(formData, "placement") || "featured",
      startDate: text(formData, "startDate"),
      endDate: text(formData, "endDate"),
      campaignStatus:
        campaignStatus && isCampaignStatus(campaignStatus)
          ? campaignStatus
          : "draft",
      externalReference: text(formData, "externalReference") || null,
    });
    revalidatePath("/admin/monetization");
    revalidatePath(`/admin/tools/${toolId}`);
    redirect(
      `/admin/monetization?message=${message(
        result.ok ? "تم حفظ الحملة" : (result.error ?? "فشل الإجراء"),
      )}`,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function setSponsoredStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await actorOrRedirect();
  const status = text(formData, "campaignStatus");
  try {
    if (!isCampaignStatus(status)) {
      redirect(
        `/admin/monetization?message=${message("حالة الحملة غير صالحة")}`,
      );
    }
    const result = await setSponsoredStatus({
      actor: user,
      listingId: text(formData, "listingId"),
      campaignStatus: status,
    });
    revalidatePath("/admin/monetization");
    redirect(
      `/admin/monetization?message=${message(
        result.ok ? "تم تحديث حالة الحملة" : (result.error ?? "فشل الإجراء"),
      )}`,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}
