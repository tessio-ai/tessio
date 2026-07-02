CREATE TYPE "public"."asset_status" AS ENUM('in_use', 'in_stock', 'retired');--> statement-breakpoint
CREATE TYPE "public"."kb_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."submission_source" AS ENUM('portal', 'internal');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schema_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"asset_tag" text,
	"serial" text,
	"status" "asset_status",
	"owner_id" uuid,
	"location" text,
	"purchased_at" timestamp with time zone,
	"warranty_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schema_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text,
	"slug" text,
	"status" "kb_status",
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"content_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schema_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"form_schema_id" uuid,
	"submitted_by" uuid,
	"source" "submission_source"
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "assets_org_status_idx" ON "assets" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "assets_data_gin_idx" ON "assets" USING gin ("data");--> statement-breakpoint
CREATE INDEX "kb_articles_org_idx" ON "kb_articles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "kb_articles_org_status_idx" ON "kb_articles" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "kb_articles_data_gin_idx" ON "kb_articles" USING gin ("data");--> statement-breakpoint
CREATE INDEX "form_submissions_org_idx" ON "form_submissions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "form_submissions_data_gin_idx" ON "form_submissions" USING gin ("data");