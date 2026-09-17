import { env } from "@/lib/env";

export const SITE_NAME_AR = "أدوات الذكاء الاصطناعي";
export const SITE_NAME_EN = "AI Tools Intelligence";
export const SITE_LOCALE = "ar";

export const SITE_DESCRIPTION_AR =
  "دليل عربي لاكتشاف أدوات الذكاء الاصطناعي ومراجعتها: وصف عربي واضح، تسعير، تصنيفات، ومقارنات لاختيار الأداة المناسبة.";

export const SITE_KEYWORDS_AR = [
  "أدوات الذكاء الاصطناعي",
  "ذكاء اصطناعي",
  "دليل أدوات AI",
  "تطبيقات الذكاء الاصطناعي",
  "أدوات عربية",
];

/** Normalized site origin without a trailing slash. */
export function siteOrigin(): string {
  return (env.siteUrl || "http://localhost:3000").replace(/\/+$/, "");
}

/** Build an absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  const origin = siteOrigin();
  if (!path || path === "/") return `${origin}/`;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function siteUrl(): string {
  return absoluteUrl("/");
}
