CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE "ticket_embeddings" (
	"ticket_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"embedded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ALTER COLUMN "features" SET DEFAULT '{"summary":false,"draft":false,"triage":false,"similar":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "embedding_model" text DEFAULT 'text-embedding-3-small' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_embeddings" ADD CONSTRAINT "ticket_embeddings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_embeddings" ADD CONSTRAINT "ticket_embeddings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_embeddings_org_idx" ON "ticket_embeddings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ticket_embeddings_hnsw_idx" ON "ticket_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "ai_settings" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "ai_settings" DROP COLUMN "base_url";