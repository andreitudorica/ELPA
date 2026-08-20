CREATE TABLE "administrator" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'Administrator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administrator_role_check" CHECK ("administrator"."role" = 'Administrator')
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"administrator_id" uuid NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_campaign_source" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_need" text NOT NULL,
	"category_id" uuid NOT NULL,
	"country_code" text DEFAULT 'RO' NOT NULL,
	"county" text NOT NULL,
	"locality" text,
	"minimum_criteria" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_by_administrator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_campaign_country_check" CHECK ("research_campaign"."country_code" = 'RO')
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_administrator_id_administrator_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_campaign_source" ADD CONSTRAINT "research_campaign_source_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_campaign" ADD CONSTRAINT "research_campaign_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_campaign" ADD CONSTRAINT "research_campaign_created_by_administrator_id_administrator_id_fk" FOREIGN KEY ("created_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "administrator_email_unique" ON "administrator" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "category_key_unique" ON "category" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "research_campaign_source_campaign_url_unique" ON "research_campaign_source" USING btree ("research_campaign_id","url");--> statement-breakpoint
CREATE INDEX "research_campaign_source_campaign_index" ON "research_campaign_source" USING btree ("research_campaign_id");--> statement-breakpoint
CREATE INDEX "research_campaign_created_at_index" ON "research_campaign" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "administrator" ("id", "email", "display_name")
VALUES ('0198c5d2-8b7a-7000-8000-000000000001', 'admin@elpa.local', 'Local ELPA Administrator');--> statement-breakpoint
INSERT INTO "category" ("id", "key", "name")
VALUES ('0198c5d2-8b7a-7000-8000-000000000002', 'group_rental_property', 'Group Rental Property');
