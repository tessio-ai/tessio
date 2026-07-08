CREATE TABLE "slack_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"webhook_url_ciphertext" text,
	"notify_created" boolean DEFAULT true NOT NULL,
	"notify_assigned" boolean DEFAULT true NOT NULL,
	"notify_status" boolean DEFAULT true NOT NULL,
	"notify_commented" boolean DEFAULT true NOT NULL,
	"notify_sla_breach" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "slack_settings" ADD CONSTRAINT "slack_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_settings" ADD CONSTRAINT "slack_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;