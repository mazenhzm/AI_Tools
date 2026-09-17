const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
];

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL for de-duplication: lowercases the host, strips `www.`,
 * removes tracking params, sorts remaining params, drops the fragment and
 * trailing slash. Returns null for non-http(s) or un-parseable input.
 */
export function normalizeUrl(input: string): string | null {
  if (!isHttpUrl(input)) return null;
  const url = new URL(input.trim());
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  const keep = new URLSearchParams();
  const params = [...url.searchParams.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [key, value] of params) {
    if (!TRACKING_PARAMS.includes(key.toLowerCase())) keep.append(key, value);
  }
  url.search = keep.toString();

  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}${url.search}`;
}

export function extractDomain(input: string): string | null {
  const normalized = normalizeUrl(input);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function sameDomain(a: string, b: string): boolean {
  const da = extractDomain(a);
  const db = extractDomain(b);
  return da !== null && da === db;
}
