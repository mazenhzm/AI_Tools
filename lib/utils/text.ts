export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function stripHtml(input: string): string {
  return normalizeWhitespace(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

/**
 * Builds a URL-safe slug. Latin letters are lowercased, Latin accents folded
 * and Arabic diacritics/hamza variants normalized so the same word typed on
 * different keyboards yields a stable slug. Arabic letters themselves are
 * preserved (never transliterated) because they stay readable in URLs.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/\u0640/g, "")
    .replace(/[’'"]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const NAME_NOISE = [
  "ai",
  "app",
  "the",
  "inc",
  "ltd",
  "llc",
  "com",
  "official",
  "platform",
  "tool",
];

/** Aggressively normalized name used only for fuzzy duplicate detection. */
export function normalizeName(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const tokens = cleaned
    .split(" ")
    .filter((token) => token.length > 0 && !NAME_NOISE.includes(token));
  return tokens.join(" ");
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export function ensureSentence(input: string): string {
  const t = normalizeWhitespace(input);
  if (!t) return t;
  return /[.!?؟]$/.test(t) ? t : `${t}.`;
}

export function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
