CREATE TABLE "verification_decision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"category" text,
	"method" text NOT NULL,
	"outcome" text NOT NULL,
	"recommendation" text,
	"policy_version" text NOT NULL,
	"strategy" text,
	"eligibility_id" uuid,
	"supersedes_decision_id" uuid,
	"evidence_ids" uuid[] NOT NULL,
	"input_claim_ids" uuid[] NOT NULL,
	"basis" jsonb NOT NULL,
	"evidence_score" integer,
	"override_reason" text,
	"input_digest" text NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"decided_by_administrator_id" uuid NOT NULL,
	"publication" text DEFAULT 'separate_decision_required' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_decision_method_check" CHECK ("verification_decision"."method" in ('machine_policy', 'administrator')),
	CONSTRAINT "verification_decision_outcome_check" CHECK ("verification_decision"."outcome" in ('verified', 'further_research_required', 'insufficient_evidence', 'contradicted', 'not_eligible', 'rejected')),
	CONSTRAINT "verification_decision_machine_eligibility_check" CHECK (not ("verification_decision"."method" = 'machine_policy' and "verification_decision"."outcome" = 'verified') or "verification_decision"."eligibility_id" is not null),
	CONSTRAINT "verification_decision_high_consequence_check" CHECK (not ("verification_decision"."method" = 'machine_policy' and "verification_decision"."outcome" = 'verified' and "verification_decision"."category" = 'high_consequence')),
	CONSTRAINT "verification_decision_override_reason_check" CHECK ("verification_decision"."method" <> 'administrator' or ("verification_decision"."override_reason" is not null and length(trim("verification_decision"."override_reason")) >= 10)),
	CONSTRAINT "verification_decision_rejection_check" CHECK ("verification_decision"."outcome" <> 'rejected' or "verification_decision"."method" = 'administrator'),
	CONSTRAINT "verification_decision_publication_check" CHECK ("verification_decision"."publication" = 'separate_decision_required')
);
--> statement-breakpoint
CREATE TABLE "verification_eligibility" (
	"id" uuid PRIMARY KEY NOT NULL,
	"policy_version" text NOT NULL,
	"category" text NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"threshold" integer NOT NULL,
	"accepted_holdout" integer NOT NULL,
	"false_approval_upper" double precision NOT NULL,
	"reviewers" integer NOT NULL,
	"approved_by_administrator_id" uuid NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_eligibility_category_check" CHECK ("verification_eligibility"."category" in ('register_locality', 'osm_county', 'register_classified_capacity', 'explicit_text_facility', 'property_shape_count')),
	CONSTRAINT "verification_eligibility_reviewers_check" CHECK ("verification_eligibility"."reviewers" >= 2),
	CONSTRAINT "verification_eligibility_sample_check" CHECK ("verification_eligibility"."accepted_holdout" >= 100),
	CONSTRAINT "verification_eligibility_error_bound_check" CHECK ("verification_eligibility"."false_approval_upper" >= 0 and "verification_eligibility"."false_approval_upper" <= 0.05)
);
--> statement-breakpoint
CREATE TABLE "verification_evaluation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"policy_version" text NOT NULL,
	"corpus_digest" text NOT NULL,
	"report_digest" text NOT NULL,
	"report" jsonb NOT NULL,
	"evaluated_by_administrator_id" uuid NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_eligibility_id_verification_eligibility_id_fk" FOREIGN KEY ("eligibility_id") REFERENCES "public"."verification_eligibility"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_supersedes_decision_id_verification_decision_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "public"."verification_decision"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_decision" ADD CONSTRAINT "verification_decision_decided_by_administrator_id_administrator_id_fk" FOREIGN KEY ("decided_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_eligibility" ADD CONSTRAINT "verification_eligibility_evaluation_id_verification_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."verification_evaluation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_eligibility" ADD CONSTRAINT "verification_eligibility_approved_by_administrator_id_administrator_id_fk" FOREIGN KEY ("approved_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_evaluation" ADD CONSTRAINT "verification_evaluation_evaluated_by_administrator_id_administrator_id_fk" FOREIGN KEY ("evaluated_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_decision_input_unique" ON "verification_decision" USING btree ("claim_id","policy_version","method","input_digest");--> statement-breakpoint
CREATE INDEX "verification_decision_candidate_index" ON "verification_decision" USING btree ("candidate_id","decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_eligibility_active_unique" ON "verification_eligibility" USING btree ("policy_version","category") WHERE "verification_eligibility"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_evaluation_report_unique" ON "verification_evaluation" USING btree ("policy_version","corpus_digest","report_digest");