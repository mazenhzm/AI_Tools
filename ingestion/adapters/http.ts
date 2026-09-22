import { IngestionError, NetworkError, TimeoutError } from "../errors";

const DEFAULT_UA =
  "Mozilla/5.0 (compatible; AIDiscoveryBot/1.0; +https://example.com/bot)";

export const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5";

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 5000;

export interface HttpGetOptions {
  /** Abort the request after this many milliseconds. */
  timeoutMs: number;
  /** Additional retries past the first attempt for transient failures. */
  maxRetries?: number;
  /** Exponential backoff base delay in milliseconds. */
  retryBaseDelayMs?: number;
  /** Exponential backoff ceiling in milliseconds. */
  retryMaxDelayMs?: number;
  /** Injectable fetch (defaults to global fetch) for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Retryable status codes: rate limiting and transient server failures.
 * Everything else (4xx, permanent errors) fails immediately.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Parses a `Retry-After` header: either whole seconds or an absolute HTTP date.
 * Returns null when absent or unparseable.
 */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const ms = date.getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }
  return null;
}

/**
 * Computes the delay before the next retry.
 * `retryAfterSeconds` (from the server) wins when given; otherwise the caller
 * applies exponential backoff with `Math.min(base * 2^attempt, max)`.
 */
export function retryDelayMs(
  attempt: number,
  retryAfterSeconds: number | null,
  baseMs = DEFAULT_RETRY_BASE_MS,
  maxMs = DEFAULT_RETRY_MAX_MS,
): number {
  if (retryAfterSeconds !== null) return Math.max(0, retryAfterSeconds) * 1000;
  const backoff = baseMs * 2 ** Math.max(0, attempt);
  return Math.min(backoff, maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds an HTTP text getter with a hard timeout, classified errors, retry
 * with exponential backoff for network/timeout/429/5xx, and `Retry-After`
 * support. Transient failures are retried up to `maxRetries` extra attempts.
 */
export function createHttpGet(timeoutMs: number, options: Partial<HttpGetOptions> = {}) {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_MS;
  const retryMaxMs = options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function httpGet(url: string): Promise<string> {
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "user-agent": DEFAULT_UA,
            accept: ACCEPT_HEADER,
          },
        });
      } catch (err) {
        if (err instanceof IngestionError) throw err;
        const name = (err as Error)?.name;
        if (name === "AbortError") {
          if (attempt < maxRetries) {
            attempt += 1;
            await sleep(retryDelayMs(attempt - 1, null, retryBaseMs, retryMaxMs));
            continue;
          }
          clearTimeout(timer);
          throw new TimeoutError(`request timed out after ${timeoutMs}ms: ${url}`, err);
        }
        if (attempt < maxRetries) {
          attempt += 1;
          await sleep(retryDelayMs(attempt - 1, null, retryBaseMs, retryMaxMs));
          continue;
        }
        clearTimeout(timer);
        throw new NetworkError(
          `request failed for ${url}: ${(err as Error)?.message ?? "unknown"}`,
          err,
        );
      } finally {
        clearTimeout(timer);
      }

      if (res.ok) {
        return await res.text();
      }

      const retryAfterSeconds = isRetryableStatus(res.status)
        ? parseRetryAfter(res.headers.get("retry-after"))
        : null;
      const isRetryable = isRetryableStatus(res.status) && attempt < maxRetries;
      if (isRetryable) {
        attempt += 1;
        await sleep(retryDelayMs(attempt - 1, retryAfterSeconds, retryBaseMs, retryMaxMs));
        continue;
      }
      throw new NetworkError(`HTTP ${res.status} for ${url}`);
    }
  };
}