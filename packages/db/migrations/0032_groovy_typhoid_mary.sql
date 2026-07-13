CREATE TABLE "login_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"brand_name" text DEFAULT 'Tessio' NOT NULL,
	"logo" text,
	"headline" text DEFAULT 'Welcome back' NOT NULL,
	"tagline" text DEFAULT 'Sign in to your workspace to pick up where you left off.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "login_settings" ADD CONSTRAINT "login_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_settings" ADD CONSTRAINT "login_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;