// NB: vitest does NOT set NODE_ENV=test in the globalSetup process (only in
// worker processes). It must be forced here BEFORE any module that imports
// lib/env evaluates, otherwise setup would target the dev database.

async function importEnv() {
  (process.env as { NODE_ENV?: string }).NODE_ENV = "test";
  const [{ Client }, { resolve }, { sql }, { drizzle }, { migrate }, { createPool }, { env }] =
    await Promise.all([
      import("pg"),
      import("node:path"),
      import("drizzle-orm"),
      import("drizzle-orm/node-postgres"),
      import("drizzle-orm/node-postgres/migrator"),
      import("@/lib/db/db"),
      import("@/lib/env"),
    ]);
  return { Client, resolve, sql, drizzle, migrate, createPool, env };
}

function assertTestDatabaseUrl(url: string, extra?: string): string {
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test") && dbName !== "postgres") {
    throw new Error(
      `Refusing to reset non-test database "${dbName}". Connection: ${url}${extra ?? ""}`,
    );
  }
  return dbName;
}

export default async function globalSetup() {
  const { Client, resolve, sql, drizzle, migrate, createPool, env } =
    await importEnv();

  console.log("[global-setup] resetting test database:", env.databaseUrl);

  if (process.env.NODE_ENV !== "test") {
    throw new Error("global-setup must run with NODE_ENV=test");
  }

  const dbName = assertTestDatabaseUrl(env.databaseUrl);

  // Ensure the test database itself exists (docker init usually creates it).
  {
    const url = new URL(env.databaseUrl);
    const adminClient = new Client({
      host: url.hostname,
      port: Number(url.port || 5432),
      user: url.username,
      password: url.password,
      database: "postgres",
    });
    await adminClient.connect();
    try {
      await adminClient.query(
        `CREATE DATABASE "${dbName}" OWNER "${url.username}"`,
      );
    } catch (err) {
      if (String((err as { code?: string })?.code) !== "42P04") throw err;
    }
    await adminClient.end();
  }

  const pool = createPool(env.databaseUrl, 1);
  const testDb = drizzle(pool);
  // Drop BOTH the public schema and drizzle's migration ledger schema; the
  // ledger lives in `drizzle`, so leaving it behind makes migrate() a no-op.
  await testDb.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await testDb.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await testDb.execute(sql`CREATE SCHEMA public`);
  await testDb.execute(sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
  await testDb.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await migrate(testDb, {
    migrationsFolder: resolve(process.cwd(), "lib/db/migrations"),
  });
  await pool.end();
}