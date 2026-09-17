CREATE TYPE "public"."admin_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."analytics_event" AS ENUM('tool_view', 'tool_click', 'search', 'affiliate_click', 'category_view');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'pending_review', 'approved', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('fetched', 'raw_stored', 'normalized', 'validated', 'duplicate', 'ai_processing', 'ai_processed', 'fact_validated', 'published', 'rejected', 'error');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('free', 'freemium', 'paid', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."processing_kind" AS ENUM('enrich', 'localize', 'seo', 'update_analysis', 'quality');--> statement-breakpoint
CREATE TYPE "public"."revision_reason" AS ENUM('edit', 'ai_update', 'ai_create', 'admin', 'ingestion');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'completed', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('rss', 'api', 'product_sources', 'official', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tool_status" AS ENUM('draft', 'ai_processed', 'pending_review', 'approved', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TABLE "administrators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tool_id" uuid,
	"ip_hash" text,
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_processing_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid,
	"ingestion_item_id" uuid,
	"kind" "processing_kind" DEFAULT 'enrich' NOT NULL,
	"model" text,
	"prompt_version" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"confidence" numeric(5, 2),
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validated" boolean DEFAULT false NOT NULL,
	"failed" boolean DEFAULT false NOT NULL,
	"error" text,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event" "analytics_event" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"seo_title_ar" text,
	"seo_description_ar" text,
	"seo_title_en" text,
	"seo_description_en" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_tools" (
	"collection_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_tools_collection_id_tool_id_pk" PRIMARY KEY("collection_id","tool_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"slug" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"seo_title_ar" text,
	"seo_description_ar" text,
	"seo_title_en" text,
	"seo_description_en" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" "revision_reason" DEFAULT 'admin' NOT NULL,
	"editor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"normalized_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"status" "item_status" DEFAULT 'fetched' NOT NULL,
	"raw_data" jsonb,
	"normalized_data" jsonb,
	"tool_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "source_type" DEFAULT 'rss' NOT NULL,
	"url" text,
	"active" boolean DEFAULT true NOT NULL,
	"adapter_key" text DEFAULT 'rss:generic' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"placement" text DEFAULT 'featured' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"campaign_status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_features" (
	"tool_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	CONSTRAINT "tool_features_tool_id_feature_id_pk" PRIMARY KEY("tool_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "tool_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"raw_data" jsonb,
	"normalized_data" jsonb,
	"content_hash" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_tags" (
	"tool_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "tool_tags_tool_id_tag_id_pk" PRIMARY KEY("tool_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description_ar" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"short_description_ar" text,
	"short_description_en" text,
	"long_description_ar" text,
	"long_description_en" text,
	"category_id" uuid,
	"pricing_type" "pricing_type" DEFAULT 'unknown' NOT NULL,
	"pricing_verified" boolean DEFAULT false NOT NULL,
	"pricing_notes" text,
	"website_url" text,
	"affiliate_url" text,
	"logo_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "tool_status" DEFAULT 'draft' NOT NULL,
	"quality_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"seo_title_ar" text,
	"seo_description_ar" text,
	"seo_title_en" text,
	"seo_description_en" text,
	"faq_json" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_ar" text DEFAULT '' NOT NULL,
	"content_en" text DEFAULT '' NOT NULL,
	"source_url" text,
	"published_at" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_logs" ADD CONSTRAINT "ai_processing_logs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_logs" ADD CONSTRAINT "ai_processing_logs_ingestion_item_id_ingestion_items_id_fk" FOREIGN KEY ("ingestion_item_id") REFERENCES "public"."ingestion_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_tools" ADD CONSTRAINT "collection_tools_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_tools" ADD CONSTRAINT "collection_tools_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_editor_id_administrators_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."administrators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD CONSTRAINT "ingestion_items_run_id_ingestion_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD CONSTRAINT "ingestion_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD CONSTRAINT "ingestion_items_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_listings" ADD CONSTRAINT "sponsored_listings_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_features" ADD CONSTRAINT "tool_features_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_features" ADD CONSTRAINT "tool_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_sources" ADD CONSTRAINT "tool_sources_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_sources" ADD CONSTRAINT "tool_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD CONSTRAINT "tool_tags_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_tags" ADD CONSTRAINT "tool_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_idx" ON "administrators" USING btree ("email");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_idx" ON "affiliate_clicks" USING btree ("tool_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_logs_tool_idx" ON "ai_processing_logs" USING btree ("tool_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_idx" ON "analytics_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "collection_tools_tool_idx" ON "collection_tools" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_slug_idx" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "revisions_entity_idx" ON "content_revisions" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "features_key_idx" ON "features" USING btree ("normalized_key");--> statement-breakpoint
CREATE INDEX "ingestion_items_run_idx" ON "ingestion_items" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "ingestion_items_source_idx" ON "ingestion_items" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_idx" ON "ingestion_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_slug_idx" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sponsored_active_idx" ON "sponsored_listings" USING btree ("campaign_status","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sources_item_idx" ON "tool_sources" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "tool_sources_tool_idx" ON "tool_sources" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tools_status_idx" ON "tools" USING btree ("status") WHERE "tools"."status" = 'published';--> statement-breakpoint
CREATE INDEX "tools_pricing_idx" ON "tools" USING btree ("pricing_type");--> statement-breakpoint
CREATE INDEX "tools_updated_idx" ON "tools" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "tools_name_trgm_idx" ON "tools" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tools_search_idx" ON "tools" USING gin ((setweight(to_tsvector('simple', coalesce("name", '')), 'A') || setweight(to_tsvector('simple', coalesce("description_ar", '')), 'B') || setweight(to_tsvector('simple', coalesce("description_en", '')), 'B')));--> statement-breakpoint
CREATE INDEX "updates_tool_idx" ON "updates" USING btree ("tool_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "updates_source_url_idx" ON "updates" USING btree ("source_url") WHERE "updates"."source_url" IS NOT NULL;