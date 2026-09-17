"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runIngestion, summarizeRuns } from "@/ingestion/run";
import { createEnricherFromEnv } from "@/lib/ai/enrich";
import { auth } from "@/lib/auth";
import { AuthorizationError, requireActor } from "@/lib/auth/authorization";

export async function runIngestionAction(formData: FormData): Promise<void> {
  const user = (await auth())?.user ?? null;
  const rawSourceId = formData.get("sourceId");
  const sourceId =
    typeof rawSourceId === "string" && rawSourceId.length > 0
      ? rawSourceId
      : undefined;

  try {
    requireActor(user);
    const summaries = await runIngestion({
      sourceId,
      maxItems: 25,
      enrich: createEnricherFromEnv(),
    });
    const totals = summarizeRuns(summaries);
    revalidatePath("/admin");
    revalidatePath("/admin/runs");
    revalidatePath("/admin/sources");
    revalidatePath("/admin/tools");
    const message = `تم تشغيل ${totals.sources} مصدر: ${totals.created} جديد، ${totals.duplicates} مكرر، ${totals.invalid} غير صالح، ${totals.errors} خطأ`;
    redirect(`/admin/runs?message=${encodeURIComponent(message)}`);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/admin/login");
    throw error;
  }
}
