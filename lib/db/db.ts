import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

export function createPool(connectionString: string, max = 10): Pool {
  return new Pool({ connectionString, max });
}

const globalForDb = globalThis as unknown as { __aidiscoveryPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__aidiscoveryPool) {
    globalForDb.__aidiscoveryPool = createPool(env.databaseUrl);
  }
  return globalForDb.__aidiscoveryPool;
}

export const db = drizzle(getPool(), { schema });

export type Db = typeof db;