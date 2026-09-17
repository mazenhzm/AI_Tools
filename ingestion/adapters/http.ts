import { IngestionError, NetworkError, TimeoutError } from "../errors";

const DEFAULT_UA =
  "Mozilla/5.0 (compatible; AIDiscoveryBot/1.0; +https://example.com/bot)";

export const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5";

/**
 * Builds an HTTP text getter with a hard timeout and classified errors so the
 * pipeline can distinguish transient (network/timeout) from permanent failures.
 */
export function createHttpGet(timeoutMs: number) {
  return async function httpGet(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": DEFAULT_UA,
          accept: ACCEPT_HEADER,
        },
      });
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (err instanceof IngestionError) throw err;
      const name = (err as Error)?.name;
      if (name === "AbortError") {
        throw new TimeoutError(`request timed out after ${timeoutMs}ms: ${url}`, err);
      }
      throw new NetworkError(
        `request failed for ${url}: ${(err as Error)?.message ?? "unknown"}`,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
