CREATE TABLE "sso_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"issuer" text,
	"client_id" text,
	"client_secret_ciphertext" text,
	"button_label" text DEFAULT 'Sign in with SSO' NOT NULL,
	"auto_create_users" boolean DEFAULT false NOT NULL,
	"allowed_domain" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "sso_settings" ADD CONSTRAINT "sso_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;