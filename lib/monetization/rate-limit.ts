import { env } from "@/lib/env";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  reset(): void;
}

/**
 * Fixed-window in-memory rate limiter. Deliberately dependency-free: it guards
 * a single-process endpoint against trivial abuse, not a distributed attack.
 * Multi-instance deployments should move the counter to a shared store.
 */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function check(key: string, now: number = Date.now()): RateLimitResult {
    const safeLimit = Math.max(1, Math.floor(limit));
    const safeWindow = Math.max(1000, Math.floor(windowMs));
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + safeWindow });
      return { ok: true, remaining: safeLimit - 1, retryAfterSeconds: 0 };
    }

    if (entry.count >= safeLimit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }

    entry.count += 1;
    return {
      ok: true,
      remaining: safeLimit - entry.count,
      retryAfterSeconds: 0,
    };
  }

  return {
    check,
    reset() {
      hits.clear();
    },
  };
}

let clickLimiter: RateLimiter | null = null;

export function getClickRateLimiter(): RateLimiter {
  clickLimiter ??= createRateLimiter(
    env.clickRateLimitMax,
    env.clickRateLimitWindowMs,
  );
  return clickLimiter;
}
