import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

const TABLES = [
  "analytics_events",
  "affiliate_clicks",
  "field_conflicts",
  "content_revisions",
  "ai_processing_logs",
  "notification_logs",
  "notification_events",
  "alert_subscriptions",
  "model_updates",
  "model_sources",
  "models",
  "model_providers",
  "ingestion_items",
  "ingestion_runs",
  "tool_sources",
  "sponsored_listings",
  "collection_tools",
  "collections",
  "updates",
  "tool_tags",
  "tool_features",
  "features",
  "tags",
  "tools",
  "sources",
  "categories",
  "administrators",
];

export async function clearDb() {
  const list = TABLES.join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

export function asError(e: unknown): Error & { code?: string } {
  const err = e as Error & { code?: string };
  if (err?.cause && typeof (err.cause as Error & { code?: string })?.code === "string") {
    return err.cause as Error & { code?: string };
  }
  return err;
}