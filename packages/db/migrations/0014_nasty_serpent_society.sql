CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_pk" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_schemas" (
	"team_id" uuid NOT NULL,
	"schema_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_schemas_pk" UNIQUE("team_id","schema_id")
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"base_url" text,
	"api_key_ciphertext" text,
	"api_key_hint" text,
	"features" jsonb DEFAULT '{"summary":false,"draft":false,"triage":false}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ticket_ai_triage" (
	"ticket_id" uuid PRIMARY KEY NOT NULL,
	"category" text,
	"priority" text,
	"suggested_assignee_id" uuid,
	"confidence" real,
	"reasoning" text,
	"triaged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_schemas" ADD CONSTRAINT "team_schemas_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_schemas" ADD CONSTRAINT "team_schemas_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_ai_triage" ADD CONSTRAINT "ticket_ai_triage_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_ai_triage" ADD CONSTRAINT "ticket_ai_triage_suggested_assignee_id_users_id_fk" FOREIGN KEY ("suggested_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
