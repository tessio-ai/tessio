CREATE TABLE "org_counters" (
	"org_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "org_counters_org_id_entity_pk" PRIMARY KEY("org_id","entity")
);
--> statement-breakpoint
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;