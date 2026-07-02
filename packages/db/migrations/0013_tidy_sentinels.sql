CREATE TABLE "kb_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_revisions_article_version_key" UNIQUE("article_id","version")
);
--> statement-breakpoint
ALTER TABLE "kb_revisions" ADD CONSTRAINT "kb_revisions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_revisions" ADD CONSTRAINT "kb_revisions_article_id_kb_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_revisions" ADD CONSTRAINT "kb_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_revisions_article_idx" ON "kb_revisions" USING btree ("org_id","article_id");