import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums — enforced at the database level as Postgres types.
// ---------------------------------------------------------------------------

export const pricingType = pgEnum("pricing_type", [
  "free",
  "freemium",
  "paid",
  "unknown",
]);

export const toolStatus = pgEnum("tool_status", [
  "draft",
  "ai_processed",
  "pending_review",
  "approved",
  "published",
  "rejected",
  "archived",
]);

export const contentStatus = pgEnum("content_status", [
  "draft",
  "pending_review",
  "approved",
  "published",
  "rejected",
]);

export const sourceType = pgEnum("source_type", [
  "rss",
  "api",
  "product_sources",
  "official",
  "manual",
]);

export const runStatus = pgEnum("run_status", [
  "running",
  "completed",
  "failed",
  "partial",
]);

export const itemStatus = pgEnum("item_status", [
  "fetched",
  "raw_stored",
  "normalized",
  "validated",
  "duplicate",
  "updated",
  "ai_processing",
  "ai_processed",
  "fact_validated",
  "published",
  "rejected",
  "error",
]);

export const processingKind = pgEnum("processing_kind", [
  "enrich",
  "localize",
  "seo",
  "update_analysis",
  "quality",
]);

export const revisionReason = pgEnum("revision_reason", [
  "edit",
  "ai_update",
  "ai_create",
  "admin",
  "ingestion",
]);

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "ended",
]);

export const analyticsEvent = pgEnum("analytics_event", [
  "tool_view",
  "tool_click",
  "search",
  "affiliate_click",
  "category_view",
]);

export const adminRole = pgEnum("admin_role", ["admin", "editor"]);

const uuidPk = () => uuid("id").primaryKey().defaultRandom();

const now = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const updatedNow = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const bigserialPk = () => bigserial("id", { mode: "number" }).primaryKey();

const faqJsonType = () =>
  jsonb("faq_json").$type<Array<Record<string, string>>>();

// ---------------------------------------------------------------------------
// Catalog: categories
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  () => ({
    id: uuidPk(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    slug: text("slug").notNull(),
    descriptionAr: text("description_ar"),
    descriptionEn: text("description_en"),
    seoTitleAr: text("seo_title_ar"),
    seoDescriptionAr: text("seo_description_ar"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionEn: text("seo_description_en"),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => categories.id,
      { onDelete: "set null" },
    ),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

// ---------------------------------------------------------------------------
// Catalog: tools
// ---------------------------------------------------------------------------

export const tools = pgTable(
  "tools",
  () => ({
    id: uuidPk(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    descriptionAr: text("description_ar").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    shortDescriptionAr: text("short_description_ar"),
    shortDescriptionEn: text("short_description_en"),
    longDescriptionAr: text("long_description_ar"),
    longDescriptionEn: text("long_description_en"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    pricingType: pricingType("pricing_type").notNull().default("unknown"),
    pricingVerified: boolean("pricing_verified").notNull().default(false),
    pricingNotes: text("pricing_notes"),
    websiteUrl: text("website_url"),
    affiliateUrl: text("affiliate_url"),
    logoUrl: text("logo_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: toolStatus("status").notNull().default("draft"),
    qualityScore: numeric("quality_score", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    seoTitleAr: text("seo_title_ar"),
    seoDescriptionAr: text("seo_description_ar"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionEn: text("seo_description_en"),
    faqJson: faqJsonType(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [
    uniqueIndex("tools_slug_idx").on(t.slug),
    index("tools_category_idx").on(t.categoryId),
    index("tools_status_idx")
      .on(t.status)
      .where(sql`${t.status} = 'published'`),
    index("tools_pricing_idx").on(t.pricingType),
    index("tools_updated_idx").on(t.updatedAt),
    index("tools_name_trgm_idx").using(
      "gin",
      sql`lower(${t.name}) gin_trgm_ops`,
    ),
    index("tools_search_idx").using(
      "gin",
      sql`(setweight(to_tsvector('simple', coalesce(${t.name}, '')), 'A') || setweight(to_tsvector('simple', coalesce(${t.descriptionAr}, '')), 'B') || setweight(to_tsvector('simple', coalesce(${t.descriptionEn}, '')), 'B'))`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Catalog: tags
// ---------------------------------------------------------------------------

export const tags = pgTable(
  "tags",
  () => ({
    id: uuidPk(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [
    uniqueIndex("tags_name_idx").on(t.name),
    uniqueIndex("tags_slug_idx").on(t.slug),
  ],
);

export const toolTags = pgTable(
  "tool_tags",
  () => ({
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.toolId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// Catalog: features
// ---------------------------------------------------------------------------

export const features = pgTable(
  "features",
  () => ({
    id: uuidPk(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    normalizedKey: text("normalized_key").notNull(),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [uniqueIndex("features_key_idx").on(t.normalizedKey)],
);

export const toolFeatures = pgTable(
  "tool_features",
  () => ({
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.toolId, t.featureId] })],
);

// ---------------------------------------------------------------------------
// Catalog: updates (product news / change monitoring)
// ---------------------------------------------------------------------------

export const updates = pgTable(
  "updates",
  () => ({
    id: uuidPk(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    contentAr: text("content_ar").notNull().default(""),
    contentEn: text("content_en").notNull().default(""),
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    status: contentStatus("status").notNull().default("draft"),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [
    index("updates_tool_idx").on(t.toolId, t.publishedAt),
    uniqueIndex("updates_source_url_idx")
      .on(t.sourceUrl)
      .where(sql`${t.sourceUrl} IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// Catalog: collections (curated programmatic-SEO lists)
// ---------------------------------------------------------------------------

export const collections = pgTable(
  "collections",
  () => ({
    id: uuidPk(),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    slug: text("slug").notNull(),
    descriptionAr: text("description_ar"),
    descriptionEn: text("description_en"),
    seoTitleAr: text("seo_title_ar"),
    seoDescriptionAr: text("seo_description_ar"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionEn: text("seo_description_en"),
    status: contentStatus("status").notNull().default("draft"),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [uniqueIndex("collections_slug_idx").on(t.slug)],
);

export const collectionTools = pgTable(
  "collection_tools",
  () => ({
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  }),
  (t) => [
    primaryKey({ columns: [t.collectionId, t.toolId] }),
    index("collection_tools_tool_idx").on(t.toolId),
  ],
);

// ---------------------------------------------------------------------------
// Sources & ingestion
// ---------------------------------------------------------------------------

export const sources = pgTable(
  "sources",
  () => ({
    id: uuidPk(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: sourceType("type").notNull().default("rss"),
    url: text("url"),
    active: boolean("active").notNull().default(true),
    adapterKey: text("adapter_key").notNull().default("rss:generic"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastFetchedAt: timestamp("last_fetched_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastSuccessAt: timestamp("last_success_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [uniqueIndex("sources_slug_idx").on(t.slug)],
);

export const toolSources = pgTable(
  "tool_sources",
  () => ({
    id: uuidPk(),
    toolId: uuid("tool_id").references(() => tools.id, {
      onDelete: "cascade",
    }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    normalizedData: jsonb("normalized_data").$type<Record<string, unknown>>(),
    contentHash: text("content_hash"),
    firstSeenAt: timestamp("first_seen_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    uniqueIndex("tool_sources_item_idx").on(t.sourceId, t.sourceItemId),
    index("tool_sources_tool_idx").on(t.toolId),
  ],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  () => ({
    id: uuidPk(),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    status: runStatus("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    metrics: jsonb("metrics")
      .$type<Record<string, number | string>>()
      .notNull()
      .default({}),
    error: text("error"),
    createdAt: now(),
  }),
  (t) => [
    index("ingestion_runs_source_idx").on(t.sourceId, t.startedAt),
  ],
);

export const ingestionItems = pgTable(
  "ingestion_items",
  () => ({
    id: uuidPk(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id").notNull(),
    status: itemStatus("status").notNull().default("fetched"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    normalizedData: jsonb("normalized_data").$type<Record<string, unknown>>(),
    toolId: uuid("tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [
    index("ingestion_items_run_idx").on(t.runId, t.status),
    index("ingestion_items_source_idx").on(t.sourceId, t.sourceItemId),
  ],
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const administrators = pgTable(
  "administrators",
  () => ({
    id: uuidPk(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRole("role").notNull().default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [uniqueIndex("admins_email_idx").on(t.email)],
);

// ---------------------------------------------------------------------------
// AI & content
// ---------------------------------------------------------------------------

export const aiProcessingLogs = pgTable(
  "ai_processing_logs",
  () => ({
    id: uuidPk(),
    toolId: uuid("tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),
    ingestionItemId: uuid("ingestion_item_id").references(
      () => ingestionItems.id,
      { onDelete: "set null" },
    ),
    kind: processingKind("kind").notNull().default("enrich"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    confidence: numeric("confidence", { precision: 5, scale: 2 }),
    warnings: jsonb("warnings").$type<Array<string>>().notNull().default([]),
    validated: boolean("validated").notNull().default(false),
    failed: boolean("failed").notNull().default(false),
    error: text("error"),
    rawResponse: jsonb("raw_response").$type<unknown>(),
    createdAt: now(),
  }),
  (t) => [index("ai_logs_tool_idx").on(t.toolId, t.createdAt)],
);

export const contentRevisions = pgTable(
  "content_revisions",
  () => ({
    id: uuidPk(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    field: text("field").notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    reason: revisionReason("reason").notNull().default("admin"),
    editorId: uuid("editor_id").references(() => administrators.id, {
      onDelete: "set null",
    }),
    createdAt: now(),
  }),
  (t) => [
    index("revisions_entity_idx").on(
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Monetization
// ---------------------------------------------------------------------------

export const sponsoredListings = pgTable(
  "sponsored_listings",
  () => ({
    id: uuidPk(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    placement: text("placement").notNull().default("featured"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    campaignStatus: campaignStatus("campaign_status").notNull().default("draft"),
    externalReference: text("external_reference"),
    createdAt: now(),
    updatedAt: updatedNow(),
  }),
  (t) => [
    index("sponsored_active_idx").on(
      t.campaignStatus,
      t.startDate,
      t.endDate,
    ),
  ],
);

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  () => ({
    id: bigserialPk(),
    toolId: uuid("tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    createdAt: now(),
  }),
  (t) => [
    index("affiliate_clicks_idx").on(t.toolId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Analytics (lightweight event log)
// ---------------------------------------------------------------------------

export const analyticsEvents = pgTable(
  "analytics_events",
  () => ({
    id: bigserialPk(),
    event: analyticsEvent("event").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: now(),
  }),
  (t) => [index("analytics_events_idx").on(t.event, t.createdAt)],
);