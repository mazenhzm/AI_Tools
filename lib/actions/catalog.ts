"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  createCategory,
  createCollection,
  createTag,
  deleteCategory,
  deleteCollection,
  deleteTag,
  isContentStatus,
  setCollectionTools,
  updateCategory,
  updateCollection,
} from "@/lib/services/catalog";

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

function done(path: string, ok: boolean, error?: string, success = "تم الحفظ") {
  return `${path}?message=${message(ok ? success : (error ?? "فشل الإجراء"))}`;
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await createCategory({
      actor: user,
      nameAr: text(formData, "nameAr"),
      nameEn: text(formData, "nameEn"),
      slug: text(formData, "slug") || undefined,
      descriptionAr: text(formData, "descriptionAr") || null,
      descriptionEn: text(formData, "descriptionEn") || null,
    });
    revalidatePath("/admin/categories");
    redirect(done("/admin/categories", result.ok, result.error, "تمت إضافة التصنيف"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await updateCategory({
      actor: user,
      categoryId: text(formData, "categoryId"),
      fields: {
        nameAr: text(formData, "nameAr"),
        nameEn: text(formData, "nameEn"),
        slug: text(formData, "slug"),
        descriptionAr: text(formData, "descriptionAr") || null,
      },
    });
    revalidatePath("/admin/categories");
    redirect(done("/admin/categories", result.ok, result.error, "تم تحديث التصنيف"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await deleteCategory({
      actor: user,
      categoryId: text(formData, "categoryId"),
    });
    revalidatePath("/admin/categories");
    redirect(done("/admin/categories", result.ok, result.error, "تم حذف التصنيف"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function createTagAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await createTag({
      actor: user,
      name: text(formData, "name"),
    });
    revalidatePath("/admin/tags");
    redirect(done("/admin/tags", result.ok, result.error, "تمت إضافة الوسم"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await deleteTag({
      actor: user,
      tagId: text(formData, "tagId"),
    });
    revalidatePath("/admin/tags");
    redirect(done("/admin/tags", result.ok, result.error, "تم حذف الوسم"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function createCollectionAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await createCollection({
      actor: user,
      titleAr: text(formData, "titleAr"),
      titleEn: text(formData, "titleEn"),
      slug: text(formData, "slug") || undefined,
      descriptionAr: text(formData, "descriptionAr") || null,
    });
    revalidatePath("/admin/collections");
    if (result.ok) {
      redirect(
        `/admin/collections/${result.id}?message=${message("تم إنشاء القائمة")}`,
      );
    }
    redirect(done("/admin/collections", false, result.error));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function updateCollectionAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  const collectionId = text(formData, "collectionId");
  try {
    const result = await updateCollection({
      actor: user,
      collectionId,
      fields: {
        titleAr: text(formData, "titleAr"),
        titleEn: text(formData, "titleEn"),
        slug: text(formData, "slug"),
        descriptionAr: text(formData, "descriptionAr") || null,
      },
    });
    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collectionId}`);
    redirect(done(`/admin/collections/${collectionId}`, result.ok, result.error));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function setCollectionStatusAction(
  formData: FormData,
): Promise<void> {
  const user = await actorOrRedirect();
  const collectionId = text(formData, "collectionId");
  const status = text(formData, "status");
  try {
    if (!isContentStatus(status)) {
      redirect(
        done(`/admin/collections/${collectionId}`, false, "حالة غير صالحة"),
      );
    }
    const result = await updateCollection({
      actor: user,
      collectionId,
      fields: { status },
    });
    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collectionId}`);
    redirect(done(`/admin/collections/${collectionId}`, result.ok, result.error));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const user = await actorOrRedirect();
  try {
    const result = await deleteCollection({
      actor: user,
      collectionId: text(formData, "collectionId"),
    });
    revalidatePath("/admin/collections");
    redirect(done("/admin/collections", result.ok, result.error, "تم حذف القائمة"));
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}

export async function setCollectionToolsAction(
  formData: FormData,
): Promise<void> {
  const user = await actorOrRedirect();
  const collectionId = text(formData, "collectionId");
  const toolIds = formData
    .getAll("toolIds")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  try {
    const result = await setCollectionTools({
      actor: user,
      collectionId,
      toolIds,
    });
    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${collectionId}`);
    redirect(
      done(
        `/admin/collections/${collectionId}`,
        result.ok,
        result.error,
        `تم حفظ ${result.count ?? 0} أداة`,
      ),
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}
