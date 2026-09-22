import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { clearDb } from "../db/helpers";

async function insertSource(overrides: Partial<typeof s.sources.$inferInsert> = {}) {
  const [source] = await db
    .insert(s.sources)
    .values({
      name: "Worker Exit Source",
      slug: "worker-exit-source",
      type: "manual",
      adapterKey: "fixture:inline",
      config: { fixturePath: "tests/fixtures/rss/valid.xml" },
      active: true,
      ...overrides,
    })
    .returning();
  return source;
}

function runWorker(sourceId: string) {
  return spawnSync(
    process.execPath,
    [
      resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      resolve(process.cwd(), "scripts/worker.ts"),
      "--json",
      "--source",
      sourceId,
    ],
    {
      cwd: resolve(process.cwd()),
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, NODE_ENV: "test" },
    },
  );
}

describe("worker exit code (scheduler alert signal)", () => {
  it("exits 0 when every source completes", async () => {
    await clearDb();
    const source = await insertSource();
    const result = runWorker(source.id);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("run_summary");
    expect(result.stdout).toContain('"status":"completed"');
  });

  it("exits 1 with a failed run when a source fails", async () => {
    await clearDb();
    const source = await insertSource({
      config: { fixturePath: "tests/fixtures/rss/malformed.xml" },
    });
    const result = runWorker(source.id);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("run_summary");
    expect(result.stdout).toContain('"status":"failed"');
  });
});