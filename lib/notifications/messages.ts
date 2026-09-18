import { modelUpdateKindLabel } from "@/lib/ui/labels";
import { absoluteUrl } from "@/lib/seo/site";
import type { ModelRow, ModelUpdateRow, NotificationMessage, ProviderRow } from "./types";

/**
 * Builds the deterministic, Arabic-first text used for both email and
 * Telegram change notifications. No credentials are ever included.
 */
export function buildModelUpdateNotification(args: {
  model: ModelRow;
  provider: ProviderRow | null;
  update: ModelUpdateRow;
}): NotificationMessage {
  const { model, provider, update } = args;
  const subject =
    update.kind === "new_version"
      ? `إصدار جديد: ${model.name}${provider ? ` (${provider.name})` : ""}`
      : `تحديث: ${model.name}${provider ? ` (${provider.name})` : ""}`;

  const lines = [
    `نموذج: ${model.name}${provider ? ` — موفر: ${provider.name}` : ""}`,
    `نوع التحديث: ${modelUpdateKindLabel(update.kind)}`,
    "",
    update.title || undefined,
    update.contentAr || undefined,
    update.sourceUrl ? `المصدر: ${update.sourceUrl}` : undefined,
    "",
    `المزيد: ${absoluteUrl(`/models/${model.slug}`)}`,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

  return { subject, text: lines.join("\n") };
}