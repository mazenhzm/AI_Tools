CREATE TYPE "public"."conflict_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "field_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"stored_value" jsonb,
	"value_a" jsonb,
	"value_b" jsonb,
	"source_a_id" uuid,
	"source_b_id" uuid,
	"status" "conflict_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_value" jsonb,
	"editor_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "authority_tier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "field_conflicts" ADD CONSTRAINT "field_conflicts_source_a_id_sources_id_fk" FOREIGN KEY ("source_a_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_conflicts" ADD CONSTRAINT "field_conflicts_source_b_id_sources_id_fk" FOREIGN KEY ("source_b_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_conflicts" ADD CONSTRAINT "field_conflicts_editor_id_administrators_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."administrators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_conflicts_open_idx" ON "field_conflicts" USING btree ("entity_type","entity_id","field","source_a_id","source_b_id") WHERE "field_conflicts"."status" = 'open';--> statement-breakpoint
CREATE INDEX "field_conflicts_status_idx" ON "field_conflicts" USING btree ("status","detected_at");--> statement-breakpoint
CREATE INDEX "field_conflicts_entity_idx" ON "field_conflicts" USING btree ("entity_id","field");