import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "@/lib/env";
import {
  backupFileName,
  parseBackupTimestamp,
  selectExpiredBackups,
} from "@/lib/ops/backup";

/**
 * Dump the configured database with `pg_dump` executed inside the Postgres
 * container (no local client required), copy the dump out, verify it is
 * non-empty and prune old dumps down to BACKUP_RETENTION.
 *
 * Usage: npm run db:backup
 */

const TMP_PATH = "/tmp/aidiscovery-backup.dump";

function run(command: string, args: string[], label: string): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${label} exited with ${result.status}: ${detail}`);
  }
  return result.stdout ?? "";
}

function main() {
  const url = new URL(env.databaseUrl);
  const database = url.pathname.replace(/^\//, "");
  const user = decodeURIComponent(url.username);
  const container = env.pgContainer;
  const backupDir = resolve(process.cwd(), env.backupDir);

  console.log(`[backup] dumping ${database} from container ${container}`);
  run("docker", ["exec", container, "pg_dump", "-U", user, "-d", database, "-F", "c", "-f", TMP_PATH], "pg_dump");

  mkdirSync(backupDir, { recursive: true });
  const fileName = backupFileName(new Date(), database);
  const target = join(backupDir, fileName);
  run("docker", ["cp", `${container}:${TMP_PATH}`, target], "docker cp");
  run("docker", ["exec", container, "rm", "-f", TMP_PATH], "cleanup");

  const bytes = statSync(target).size;
  if (bytes === 0) {
    rmSync(target, { force: true });
    throw new Error("backup file is empty — aborting");
  }

  console.log(`[backup] wrote ${target} (${(bytes / 1024).toFixed(1)} KiB)`);

  const retention = Math.max(1, Math.floor(env.backupRetention));
  const expired = selectExpiredBackups(readdirSync(backupDir), retention);
  for (const name of expired) {
    rmSync(join(backupDir, name), { force: true });
    console.log(`[backup] pruned ${name}`);
  }

  const remaining = readdirSync(backupDir)
    .filter((name) => name.endsWith(".dump"))
    .sort(
      (a, b) => parseBackupTimestamp(b) - parseBackupTimestamp(a),
    );
  console.log(`[backup] retention ${retention}, kept ${remaining.length}`);
}

try {
  main();
} catch (error) {
  console.error(`[backup] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
