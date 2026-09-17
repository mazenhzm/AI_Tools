import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function contentHash(parts: Array<string | null | undefined>): string {
  return sha256(parts.map((p) => p ?? "").join("\u0000"));
}

/** One-way hash for storing client IPs without persisting personal data. */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
