export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Resolves the effective HTTP timeout for a source. Guards against
 * `Number(undefined)` being NaN, which previously produced
 * `setTimeout(NaN)` -> an instantaneous abort ("timed out after NaNms").
 */
export function resolveTimeoutMs(
  configured: unknown,
  fallback = DEFAULT_TIMEOUT_MS,
): number {
  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Sleep helper for inter-source pacing (rate-limit aware fetching). */
export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}