ALTER TABLE "teams" ADD COLUMN "email_address" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "email_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_email_key" UNIQUE("org_id","email_address");