import { eq } from "drizzle-orm";
import { getPool, db } from "@/lib/db/db";
import { env } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { runModelSource, type RunModelSourceResult } from "../ingestion/models/pipeline";

type LogLevel = "info" | "warn" | "error";

interface WorkerArgs {
  sourceId?: string;
  maxItems?: number;
  json: boolean;
  loop: boolean;
  intervalMs: number;
}

function parseArgs(argv: string[]): WorkerArgs {
  const args: WorkerArgs = { json: false, loop: false, intervalMs: 60_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source" && argv[i + 1]) {
      args.sourceId = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--source=")) {
      args.sourceId = arg.slice("--source=".length);
    } else if (arg === "--max-items" && argv[i + 1]) {
      args.maxItems = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--max-items=")) {
      args.maxItems = Number(arg.slice("--max-items=".length));
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--loop") {
      args.loop = true;
    } else if (arg === "--interval" && argv[i + 1]) {
      args.intervalMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--interval=")) {
      args.intervalMs = Number(arg.slice("--interval=".length));
    }
  }
  return args;
}

function makeLogger(json: boolean) {
  return function log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    if (json) {
      process.stdout.write(
        `${JSON.stringify({
          ts: new Date().toISOString(),
          level,
          service: "worker-models",
          message,
          ...(meta ? { meta } : {}),
        })}\n`,
      );
      return;
    }
    const line = `[worker-models] ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
    if (level === "error") console.error(line, meta ?? "");
    else if (level === "warn") console.warn(line, meta ?? "");
    else console.log(line, meta ?? "");
  };
}

function summarize(result: RunModelSourceResult) {
  return {
    status: result.status,
    runId: result.runId,
    ...result.metrics,
  };
}

async function selectSources(sourceId?: string) {
  if (sourceId) {
    return db
      .select({
        id: s.sources.id,
        name: s.sources.name,
        adapterKey: s.sources.adapterKey,

      })
      .from(s.sources)
.where(eq(s.sources.id, sourceId))
      .limit(1);
  }
  return db
      .select({
        id: s.sources.id,
        name: s.sources.name,
        adapterKey: s.sources.adapterKey,
      })
      .from(s.sources)
      .where(eq(s.sources.active, true));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = makeLogger(args.json);
  const startedAt = Date.now();

  const u = new URL(env.databaseUrl);
  log("info", "starting model ingestion", {
    database: `${u.hostname}:${u.port}${u.pathname}`,
    sourceId: args.sourceId ?? null,
    maxItems: args.maxItems ?? null,
    loop: args.loop,
    intervalMs: args.intervalMs,
  });

  const runSingle = async () => {
    const sources = await selectSources(args.sourceId);
    const modelSources = sources.filter((source) => source.adapterKey.startsWith("model:"));
    if (modelSources.length === 0) {
      log("warn", "no active model sources to run");
    }
    let failed = false;
    for (const source of modelSources) {
      const result = await runModelSource({
        sourceId: source.id,
        maxItems: Number.isFinite(args.maxItems) ? args.maxItems : undefined,
      });
      log(
        result.status === "failed" ? "error" : "info",
        `model source ${source.name} finished`,
        { adapter: source.adapterKey, ...summarize(result) },
      );
      if (result.status === "failed") failed = true;
    }
    log(failed ? "error" : "info", "run_summary", {
      sources: modelSources.length,
      durationMs: Date.now() - startedAt,
    });
    return failed;
  };

  if (args.loop) {
let first = true;
    while (true) {
      if (!first) await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
      first = false;
      try {
        await runSingle();
      } catch (err) {
        log("error", "model worker loop iteration failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    const failed = await runSingle();
    await getPool().end();
    if (failed) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      service: "worker-models",
      message: "model worker crashed",
      meta: { error: err instanceof Error ? err.message : String(err) },
    }),
  );
  process.exit(1);
});
