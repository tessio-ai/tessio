CREATE TABLE "record_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"from_type" "record_type" NOT NULL,
	"from_id" uuid NOT NULL,
	"to_type" "record_type" NOT NULL,
	"to_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "record_links" ADD CONSTRAINT "record_links_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_links_from_idx" ON "record_links" USING btree ("org_id","from_type","from_id");--> statement-breakpoint
CREATE INDEX "record_links_to_idx" ON "record_links" USING btree ("org_id","to_type","to_id");--> statement-breakpoint
CREATE INDEX "record_links_rel_idx" ON "record_links" USING btree ("org_id","relationship_type");