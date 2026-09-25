import { config } from "dotenv";
import { resolve } from "node:path";

const ROOT = process.cwd();

function loadEnvFile() {
  const explicit = process.env.DOTENV_FILE;
  if (explicit) {
    config({ path: resolve(/* turbopackIgnore: true */ ROOT, explicit) });
    return;
  }
  switch (process.env.NODE_ENV) {
    case "test":
      config({ path: resolve(ROOT, ".env.test") });
      break;
    case "production":
      config({ path: resolve(ROOT, ".env.production") });
      break;
    default:
      config({ path: resolve(ROOT, ".env.development") });
  }
  // base .env may still hold shared values
  config({ path: resolve(ROOT, ".env") });
}

loadEnvFile();

const DEV_DB_URL =
  "postgresql://aidiscovery:aidiscovery_dev@localhost:5433/aidiscovery_dev";
const TEST_DB_URL =
  "postgresql://aidiscovery:aidiscovery_dev@localhost:5433/aidiscovery_test";

function databaseUrl(): string {
  if (process.env.NODE_ENV === "test") {
    // Never fall back to DATABASE_URL in tests — test runs must be isolated
    // from dev/prod data by construction.
    return process.env.DATABASE_URL_TEST ?? TEST_DB_URL;
  }
  return process.env.DATABASE_URL ?? DEV_DB_URL;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: databaseUrl(),
  databaseUrlTest: TEST_DB_URL,
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 60000),
  authSecret: process.env.AUTH_SECRET ?? "",
  autoPublishMinScore: Number(process.env.AUTO_PUBLISH_MIN_SCORE ?? 80),
  ingestionCron: process.env.INGESTION_CRON ?? "0 */6 * * *",
  ingestionRateLimitDelayMs: Number(
    process.env.INGESTION_RATE_LIMIT_DELAY_MS ?? 1500,
  ),
  adsenseClient: process.env.ADSENSE_CLIENT ?? "",
  adsenseSlots: {
    header: process.env.ADSENSE_SLOT_HEADER ?? "",
    inContent: process.env.ADSENSE_SLOT_IN_CONTENT ?? "",
    sidebar: process.env.ADSENSE_SLOT_SIDEBAR ?? "",
    listings: process.env.ADSENSE_SLOT_LISTINGS ?? "",
  },
  affiliateDefaultTag: process.env.AFFILIATE_DEFAULT_TAG ?? "",
  affiliateTrackingEndpoint:
    process.env.AFFILIATE_TRACKING_ENDPOINT ?? "/api/track/click",
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@example.com",
  clickRateLimitMax: Number(process.env.CLICK_RATE_LIMIT_MAX ?? 30),
  clickRateLimitWindowMs: Number(
    process.env.CLICK_RATE_LIMIT_WINDOW_MS ?? 60_000,
  ),
  pgContainer: process.env.PG_CONTAINER ?? "aidiscovery-pg",
  backupDir: process.env.BACKUP_DIR ?? "backups",
  backupRetention: Number(process.env.BACKUP_RETENTION ?? 7),

  // --- Change alerts / notifications (DISABLED in v3 / P6 cancelled) ---
  // Notifications are retired: end-user visible flows are website-first (/updates).
  // The flag defaults to false and is only opt-in true for historical/legacy flows.
  notificationsEnabled: process.env.NOTIFICATIONS_ENABLED === "true",
  emailFrom: process.env.EMAIL_FROM ?? "",
  smtpHost: process.env.EMAIL_SMTP_HOST ?? "",
  smtpPort: Number(process.env.EMAIL_SMTP_PORT ?? 587),
  smtpUser: process.env.EMAIL_SMTP_USER ?? "",
  smtpPassword: process.env.EMAIL_SMTP_PASSWORD ?? "",
  smtpSecure: process.env.EMAIL_SMTP_SECURE === "1" || process.env.EMAIL_SMTP_SECURE === "true",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  subscriptionsMaxPerReceiver: Number(
    process.env.SUBSCRIPTIONS_MAX_PER_RECEIVER ?? 25,
  ),
};

/** Guard used by scripts that must never run against data they shouldn't touch. */
export function assertSafeWriteTarget(allowTest = false) {
  if (process.env.NODE_ENV === "test" && !allowTest) {
    throw new Error("Refusing to write to the test database from a non-test script.");
  }
}