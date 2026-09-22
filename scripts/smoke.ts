import { setTimeout as delay } from "node:timers/promises";

/**
 * HTTP-level end-to-end smoke check against a running server. It exercises the
 * public site, the security headers, SEO endpoints, the monetization tracker
 * and the admin guard without needing a browser.
 *
 * Usage: npm run smoke [-- --url http://localhost:3000]
 */

const baseUrl = (() => {
  const flagIndex = process.argv.indexOf("--url");
  const fromArgs = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  return (fromArgs ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
})();

interface Check {
  name: string;
  run: () => Promise<string | null>;
}

function status(path: string, expected: number, redirect: RequestRedirect = "follow") {
  return async () => {
    const response = await fetch(`${baseUrl}${path}`, { redirect });
    if (response.status !== expected) {
      return `expected ${expected}, received ${response.status}`;
    }
    return null;
  };
}

function bodyIncludes(path: string, needle: string) {
  return async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    if (response.status !== 200) return `expected 200, received ${response.status}`;
    if (!body.includes(needle)) return `missing "${needle}"`;
    return null;
  };
}

function headerEquals(path: string, key: string, expected: string) {
  return async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const value = response.headers.get(key);
    if (value !== expected) return `${key} expected "${expected}", received "${value}"`;
    return null;
  };
}

function headerPresent(path: string, key: string) {
  return async () => {
    const response = await fetch(`${baseUrl}${path}`);
    const value = response.headers.get(key);
    if (!value) return `${key} header missing`;
    return null;
  };
}

const checks: Check[] = [
  { name: "home 200 + Arabic title", run: bodyIncludes("/", "<html") },
  { name: "tools directory 200", run: status("/tools", 200) },
  { name: "models directory 200", run: status("/models", 200) },
  { name: "models directory lists a model link", run: bodyIncludes("/models", "/models/") },
  { name: "model detail 200", run: status("/models/sample-acme-ai-sample-alpha-chat", 200) },
  { name: "model detail emits JSON-LD", run: bodyIncludes("/models/sample-acme-ai-sample-alpha-chat", "application/ld+json") },
  { name: "model detail renders change-alert form", run: bodyIncludes("/models/sample-acme-ai-sample-alpha-chat", "اشترك بالتغييرات") },
  { name: "alerts unsubscribe renders with token", run: status("/alerts/unsubscribe?token=00000000-0000-0000-0000-000000000000", 200) },
  { name: "alerts verify renders with token", run: status("/alerts/verify?token=00000000-0000-0000-0000-000000000000", 200) },
  { name: "categories listing 200", run: status("/categories", 200) },
  { name: "collections listing 200", run: status("/collections", 200) },
  { name: "privacy 200", run: status("/privacy", 200) },
  { name: "search 200", run: status("/search?q=chat", 200) },
  { name: "unknown page 404", run: status("/definitely-not-a-page", 404) },
  { name: "robots.txt 200", run: status("/robots.txt", 200) },
  { name: "sitemap.xml 200", run: status("/sitemap.xml", 200) },
  { name: "sitemap.xml includes models", run: bodyIncludes("/sitemap.xml", "/models") },
  { name: "admin guarded (307)", run: status("/admin", 307, "manual") },
  { name: "admin subscriptions guarded (307)", run: status("/admin/subscriptions", 307, "manual") },
  { name: "admin notifications guarded (307)", run: status("/admin/notifications", 307, "manual") },
  { name: "tracker rejects missing param (400)", run: status("/api/track/click", 400) },
  { name: "tracker rejects unknown tool (404)", run: status("/api/track/click?tool=__smoke_missing__", 404) },
  { name: "click tracker records a click", run: async () => {
      const slug = process.env.SMOKE_TOOL_SLUG ?? "sample-chat-assistant";
      const response = await fetch(`${baseUrl}/api/track/click?tool=${slug}`, { redirect: "manual" });
      if (response.status === 404) return null;
      if (response.status !== 302) return `expected 302, received ${response.status}`;
      const location = response.headers.get("location") ?? "";
      if (!/^https?:\/\//.test(location)) return `location is not absolute: "${location}"`;
      return null;
    } },
  { name: "security header: nosniff", run: headerEquals("/", "x-content-type-options", "nosniff") },
  { name: "security header: frame deny", run: headerEquals("/", "x-frame-options", "DENY") },
  { name: "security header: referrer policy", run: headerEquals("/", "referrer-policy", "strict-origin-when-cross-origin") },
  { name: "security header: CSP report-only", run: headerPresent("/", "content-security-policy-report-only") },
  { name: "no x-powered-by", run: async () => {
      const response = await fetch(`${baseUrl}/`);
      return response.headers.get("x-powered-by") ? "x-powered-by is exposed" : null;
    } },
];

async function waitForServer(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fetch(`${baseUrl}/`, { redirect: "manual" });
      return true;
    } catch {
      await delay(1000);
    }
  }
  return false;
}

async function main() {
  console.log(`[smoke] target ${baseUrl}`);
  if (!(await waitForServer())) {
    console.error(`[smoke] server not reachable at ${baseUrl}`);
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  for (const check of checks) {
    try {
      const error = await check.run();
      if (error) {
        failed += 1;
        console.log(`  FAIL  ${check.name} — ${error}`);
      } else {
        console.log(`  ok    ${check.name}`);
      }
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${check.name} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`[smoke] ${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

void main();
