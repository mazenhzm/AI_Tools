const TOOL_STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  ai_processed: "معالج بالذكاء الاصطناعي",
  pending_review: "بانتظار المراجعة",
  approved: "معتمد",
  published: "منشور",
  rejected: "مرفوض",
  archived: "مؤرشف",
};

const TOOL_STATUS_CLASS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ai_processed: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  pending_review:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  published:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  archived: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PRICING_AR: Record<string, string> = {
  free: "مجاني",
  freemium: "مجاني جزئياً",
  paid: "مدفوع",
  unknown: "غير معروف",
};

const RUN_STATUS_AR: Record<string, string> = {
  running: "قيد التشغيل",
  completed: "مكتمل",
  failed: "فاشل",
  partial: "جزئي",
};

const CONTENT_STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  pending_review: "بانتظار المراجعة",
  approved: "معتمد",
  published: "منشور",
  rejected: "مرفوض",
};

const CAMPAIGN_STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  active: "نشطة",
  paused: "متوقفة مؤقتاً",
  ended: "منتهية",
};

export function toolStatusLabel(status: string): string {
  return TOOL_STATUS_AR[status] ?? status;
}

export function toolStatusClass(status: string): string {
  return TOOL_STATUS_CLASS[status] ?? TOOL_STATUS_CLASS.draft;
}

export function pricingLabel(pricing: string): string {
  return PRICING_AR[pricing] ?? pricing;
}

export function runStatusLabel(status: string): string {
  return RUN_STATUS_AR[status] ?? status;
}

export function contentStatusLabel(status: string): string {
  return CONTENT_STATUS_AR[status] ?? status;
}

export function campaignStatusLabel(status: string): string {
  return CAMPAIGN_STATUS_AR[status] ?? status;
}

export const CONTENT_STATUS_VALUES = Object.keys(CONTENT_STATUS_AR);
export const CAMPAIGN_STATUS_VALUES = Object.keys(CAMPAIGN_STATUS_AR);

/** Reads a numeric metric out of a run's free-form jsonb metrics object. */
export function metricNumber(
  metrics: Record<string, number | string> | null | undefined,
  key: string,
): number {
  const value = metrics?.[key];
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}
