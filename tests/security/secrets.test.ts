import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

const SCANNED_DIRS = ["app", "components", "lib", "ingestion"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist"]);

const ENV_IMPORT_ALLOWLIST = new Set([
  "lib/env.ts",
  "lib/db/db.ts",
  "lib/monetization/ads.ts",
  "lib/monetization/rate-limit.ts",
  "lib/ai/provider.ts",
  "lib/auth.ts",
  "lib/seo/site.ts",
]);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function sourceFiles(): Promise<{ path: string; source: string }[]> {
  const result: { path: string; source: string }[] = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of await collectFiles(join(ROOT, dir))) {
      result.push({
        path: relative(ROOT, file).split(sep).join("/"),
        source: await readFile(file, "utf8"),
      });
    }
  }
  return result;
}

describe("secret exposure", () => {
  it("reads process.env only in the centralized config modules", async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles()) {
      if (!/process\.env/.test(file.source)) continue;
      if (ENV_IMPORT_ALLOWLIST.has(file.path)) continue;
      offenders.push(file.path);
    }
    expect(offenders).toEqual([]);
  });

  it("never reads process.env from the rendered app or components tree", async () => {
    const offenders = (await sourceFiles())
      .filter(
        (file) =>
          file.path.startsWith("app/") || file.path.startsWith("components/"),
      )
      .filter((file) => /process\.env/.test(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("does not mark any server-only module as a client component", async () => {
    // `@/lib/actions` is intentionally absent: "use server" modules are the
    // sanctioned bridge that client components are allowed to import.
    const serverOnlyPrefixes = [
      "@/lib/env",
      "@/lib/db",
      "@/lib/services",
      "@/lib/ai",
      "@/lib/auth",
      "@/lib/monetization/rate-limit",
      "@/lib/security/headers",
    ];
    const offenders: string[] = [];
    for (const file of await sourceFiles()) {
      if (!/^["']use client["'];/m.test(file.source)) continue;
      for (const prefix of serverOnlyPrefixes) {
        if (file.source.includes(`from "${prefix}`) || file.source.includes(`from '${prefix}`)) {
          offenders.push(`${file.path} → ${prefix}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps NEXT_PUBLIC_ variables non-sensitive", async () => {
    const example = await readFile(join(ROOT, ".env.example"), "utf8");
    const publicVars = example
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/)?.[1])
      .filter((name): name is string => Boolean(name));
    expect(publicVars.length).toBeGreaterThan(0);
    const sensitive = /SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE_URL|API_KEY/;
    expect(publicVars.filter((name) => sensitive.test(name))).toEqual([]);
  });
});
