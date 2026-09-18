CREATE TYPE "public"."model_update_kind" AS ENUM('new_model', 'new_version', 'pricing', 'context_window', 'modality', 'availability', 'metadata');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'delivered', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."sub_channel" AS ENUM('email', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."sub_status" AS ENUM('pending', 'active', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."sub_target_type" AS ENUM('model', 'provider');--> statement-breakpoint
CREATE TABLE "alert_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiver" text NOT NULL,
	"channel" "sub_channel" DEFAULT 'email' NOT NULL,
	"target_type" "sub_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"status" "sub_status" DEFAULT 'pending' NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"verified_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_item_id" text NOT NULL,
	"raw_data" jsonb,
	"normalized_data" jsonb,
	"content_hash" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"kind" "model_update_kind" NOT NULL,
	"title" text NOT NULL,
	"content_ar" text DEFAULT '' NOT NULL,
	"content_en" text DEFAULT '' NOT NULL,
	"source_url" text,
	"snapshot" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"model_identifier" text DEFAULT '' NOT NULL,
	"release_date" date,
	"current_version" text,
	"is_downloadable" boolean DEFAULT false NOT NULL,
	"context_window" integer,
	"input_price_per_1m" numeric(14, 6),
	"output_price_per_1m" numeric(14, 6),
	"pricing_notes" text,
	"modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"website_url" text,
	"description_ar" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_update_id" uuid NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"subscription_id" uuid,
	"channel" "sub_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'delivered' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "model_sources" ADD CONSTRAINT "model_sources_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_sources" ADD CONSTRAINT "model_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_updates" ADD CONSTRAINT "model_updates_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_model_update_id_model_updates_id_fk" FOREIGN KEY ("model_update_id") REFERENCES "public"."model_updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_subscription_id_alert_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."alert_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_subs_target_idx" ON "alert_subscriptions" USING btree ("receiver","channel","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_subs_token_idx" ON "alert_subscriptions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "alert_subs_status_idx" ON "alert_subscriptions" USING btree ("channel","status");--> statement-breakpoint
CREATE INDEX "alert_subs_target_id_idx" ON "alert_subscriptions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_providers_slug_idx" ON "model_providers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "model_sources_item_idx" ON "model_sources" USING btree ("source_id","source_item_id");--> statement-breakpoint
CREATE INDEX "model_sources_model_idx" ON "model_sources" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "model_updates_model_idx" ON "model_updates" USING btree ("model_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "model_updates_source_url_idx" ON "model_updates" USING btree ("source_url") WHERE "model_updates"."source_url" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "models_slug_idx" ON "models" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "models_provider_idx" ON "models" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "models_status_idx" ON "models" USING btree ("status") WHERE "models"."status" = 'published';--> statement-breakpoint
CREATE INDEX "models_release_idx" ON "models" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "models_updated_idx" ON "models" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_update_idx" ON "notification_events" USING btree ("model_update_id");--> statement-breakpoint
CREATE INDEX "notification_events_status_idx" ON "notification_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_event_sub_idx" ON "notification_logs" USING btree ("event_id","subscription_id","channel");--> statement-breakpoint
CREATE INDEX "notification_logs_sub_idx" ON "notification_logs" USING btree ("subscription_id","status");--> statement-breakpoint
ALTER TABLE "ingestion_items" ADD CONSTRAINT "ingestion_items_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE set null ON UPDATE no action;