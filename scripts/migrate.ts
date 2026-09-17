import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, getPool } from "@/lib/db/db";
import { env } from "@/lib/env";

async function main() {
  const u = new URL(env.databaseUrl);
  console.log(`[migrate] target database: ${u.hostname}:${u.port}${u.pathname}`);

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

  const migrationsFolder = resolve(process.cwd(), "lib/db/migrations");
  await migrate(db, { migrationsFolder });

  const pool = getPool();
  await pool.end();
  console.log("[migrate] migrations applied");
}

main().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});