import { config } from "dotenv";
import { resolve } from "node:path";

// Ensure DATABASE_URL is available when drizzle-kit runs outside Next.js.
config({ path: resolve(process.cwd(), ".env.development") });
config({ path: resolve(process.cwd(), ".env") });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});