ALTER TABLE "ai_settings" ADD COLUMN "provider" text DEFAULT 'openai' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "base_url" text;