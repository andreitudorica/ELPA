CREATE TABLE "reconciliation_assessment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"rule_version" text NOT NULL,
	"input_digest" text NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'research_only' NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"initiated_by_administrator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_assessment_status_check" CHECK ("reconciliation_assessment"."status" = 'research_only')
);
--> statement-breakpoint
ALTER TABLE "reconciliation_assessment" ADD CONSTRAINT "reconciliation_assessment_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_assessment" ADD CONSTRAINT "reconciliation_assessment_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_assessment" ADD CONSTRAINT "reconciliation_assessment_initiated_by_administrator_id_administrator_id_fk" FOREIGN KEY ("initiated_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_assessment_campaign_input_unique" ON "reconciliation_assessment" USING btree ("research_campaign_id","input_digest","rule_version");--> statement-breakpoint
CREATE INDEX "reconciliation_assessment_candidate_index" ON "reconciliation_assessment" USING btree ("candidate_id","assessed_at");