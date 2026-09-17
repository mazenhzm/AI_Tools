import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { env, assertSafeWriteTarget } from "@/lib/env";

async function main() {
  assertSafeWriteTarget();

  if (env.nodeEnv === "production" && process.env.ALLOW_ADMIN_SEED !== "true") {
    throw new Error(
      "Refusing to seed an admin in production. Set ALLOW_ADMIN_SEED=true to override.",
    );
  }

  const email = env.adminEmail;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set (see .env.example).",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const u = new URL(env.databaseUrl);
  console.log(`[seed:admin] target database: ${u.hostname}:${u.port}${u.pathname}`);

  const passwordHash = await hash(password, 12);

  const [existing] = await db
    .select()
    .from(s.administrators)
    .where(eq(s.administrators.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(s.administrators)
      .set({ passwordHash, role: "admin", isActive: true })
      .where(eq(s.administrators.id, existing.id));
    console.log(`[seed:admin] updated existing administrator ${email}`);
  } else {
    await db
      .insert(s.administrators)
      .values({ email, passwordHash, role: "admin", isActive: true });
    console.log(`[seed:admin] created administrator ${email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:admin] failed", err);
  process.exit(1);
});