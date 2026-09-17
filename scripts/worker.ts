import { createEnricherFromEnv } from "@/lib/ai/enrich";
import { getPool } from "@/lib/db/db";
import { env } from "@/lib/env";
import { runIngestion, summarizeRuns } from "../ingestion/run";

type LogLevel = "info" | "warn" | "error";

interface WorkerArgs {
  sourceId?: string;
  maxItems?: number;
  json: boolean;
}

function parseArgs(argv: string[]): WorkerArgs {
  const args: WorkerArgs = { json: false };
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
    }
  }
  return args;
}

/**
 * One JSON object per line when `--json` is set (easy for a log collector to
 * ingest), otherwise a timestamped human-readable line. Every run emits a
 * terminal `run_summary` event so a scheduler can alert on the last event.
 */
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
          service: "worker",
          message,
          ...(meta ? { meta } : {}),
        })}\n`,
      );
      return;
    }
    const line = `[worker] ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
    if (level === "error") console.error(line, meta ?? "");
    else if (level === "warn") console.warn(line, meta ?? "");
    else console.log(line, meta ?? "");
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = makeLogger(args.json);
  const startedAt = Date.now();

  const u = new URL(env.databaseUrl);
  log("info", "starting ingestion", {
    database: `${u.hostname}:${u.port}${u.pathname}`,
    sourceId: args.sourceId ?? null,
    maxItems: args.maxItems ?? null,
    cron: env.ingestionCron,
  });

  const enrich = createEnricherFromEnv();
  if (!enrich) {
    log("warn", "AI enrichment disabled: GEMINI_API_KEY is not set (ingestion-only run)");
  } else {
    log("info", "AI enrichment enabled", { model: env.geminiModel });
  }

  const summaries = await runIngestion({
    sourceId: args.sourceId,
    maxItems: Number.isFinite(args.maxItems) ? args.maxItems : undefined,
    enrich,
  });

  for (const summary of summaries) {
    log("info", `source ${summary.sourceName} finished`, {
      adapter: summary.adapterKey,
      status: summary.result.status,
      runId: summary.result.runId,
      ...summary.result.metrics,
    });
  }

  if (summaries.length === 0) {
    log("warn", "no active sources to run");
  }

  const totals = summarizeRuns(summaries);
  const failed = summaries.some((summary) => summary.result.status === "failed");
  log(failed ? "error" : "info", "run_summary", {
    ...totals,
    durationMs: Date.now() - startedAt,
    sources: summaries.length,
  });

  await getPool().end();
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      service: "worker",
      message: "worker crashed",
      meta: { error: err instanceof Error ? err.message : String(err) },
    }),
  );
  process.exit(1);
});
