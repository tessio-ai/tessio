CREATE TYPE "public"."agent_device_status" AS ENUM('online', 'offline');--> statement-breakpoint
CREATE TYPE "public"."agent_os_type" AS ENUM('windows', 'macos', 'linux');--> statement-breakpoint
CREATE TABLE "agent_enrollment_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"key_hash" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"enrollment_key_id" uuid,
	"token_hash" text NOT NULL,
	"machine_id" text NOT NULL,
	"hostname" text DEFAULT '' NOT NULL,
	"os_type" "agent_os_type" NOT NULL,
	"os_version" text,
	"os_build" text,
	"manufacturer" text,
	"model" text,
	"serial" text,
	"cpu" text,
	"cpu_cores" integer,
	"ram_bytes" bigint,
	"last_user" text,
	"last_boot_at" timestamp with time zone,
	"agent_version" text,
	"status" "agent_device_status" DEFAULT 'online' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_report_at" timestamp with time zone,
	"linked_asset_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "agent_devices_org_machine" UNIQUE("org_id","machine_id")
);
--> statement-breakpoint
CREATE TABLE "agent_software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"publisher" text,
	"installed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_enrollment_keys" ADD CONSTRAINT "agent_enrollment_keys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_enrollment_keys" ADD CONSTRAINT "agent_enrollment_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_devices" ADD CONSTRAINT "agent_devices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_devices" ADD CONSTRAINT "agent_devices_enrollment_key_id_agent_enrollment_keys_id_fk" FOREIGN KEY ("enrollment_key_id") REFERENCES "public"."agent_enrollment_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_devices" ADD CONSTRAINT "agent_devices_linked_asset_id_assets_id_fk" FOREIGN KEY ("linked_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_devices" ADD CONSTRAINT "agent_devices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_devices" ADD CONSTRAINT "agent_devices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_software" ADD CONSTRAINT "agent_software_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_software" ADD CONSTRAINT "agent_software_device_id_agent_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."agent_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_enrollment_keys_org_idx" ON "agent_enrollment_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "agent_enrollment_keys_hash_idx" ON "agent_enrollment_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "agent_devices_org_idx" ON "agent_devices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "agent_devices_org_status_idx" ON "agent_devices" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "agent_devices_token_idx" ON "agent_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "agent_devices_linked_asset_idx" ON "agent_devices" USING btree ("linked_asset_id");--> statement-breakpoint
CREATE INDEX "agent_software_device_idx" ON "agent_software" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "agent_software_org_name_idx" ON "agent_software" USING btree ("org_id","name");