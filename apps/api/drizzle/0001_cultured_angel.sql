CREATE TABLE "acquisition_run_record" (
	"id" uuid PRIMARY KEY NOT NULL,
	"acquisition_run_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"evidence_outcome" text NOT NULL,
	"extraction_status" text NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"in_campaign_scope" boolean NOT NULL,
	"candidate_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acquisition_run_record_evidence_outcome_check" CHECK ("acquisition_run_record"."evidence_outcome" in ('created', 'unchanged')),
	CONSTRAINT "acquisition_run_record_extraction_status_check" CHECK ("acquisition_run_record"."extraction_status" in ('parsed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "acquisition_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_artifact_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"parser_version" text NOT NULL,
	"normalizer_version" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"initiated_by_administrator_id" uuid NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_digest" text,
	"failure" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acquisition_run_source_key_check" CHECK ("acquisition_run"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania')),
	CONSTRAINT "acquisition_run_stage_check" CHECK ("acquisition_run"."stage" in ('import')),
	CONSTRAINT "acquisition_run_status_check" CHECK ("acquisition_run"."status" in ('running', 'succeeded', 'completed_with_rejections', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "candidate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_record_key" text NOT NULL,
	"kind" text NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"latest_evidence_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"county_code" text,
	"settlement_name" text,
	"screening_class" text NOT NULL,
	"first_seen_run_id" uuid NOT NULL,
	"last_seen_run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_source_key_check" CHECK ("candidate"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania')),
	CONSTRAINT "candidate_kind_check" CHECK ("candidate"."kind" in ('offer')),
	CONSTRAINT "candidate_verification_status_check" CHECK ("candidate"."verification_status" = 'unverified'),
	CONSTRAINT "candidate_screening_class_check" CHECK ("candidate"."screening_class" in ('plausible', 'ambiguous', 'out_of_scope', 'insufficient_data'))
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"acquisition_run_id" uuid NOT NULL,
	"target" text NOT NULL,
	"value" jsonb NOT NULL,
	"evidence_locator" jsonb NOT NULL,
	"extraction_method" text NOT NULL,
	"confidence" double precision NOT NULL,
	"review_status" text DEFAULT 'proposed' NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_confidence_check" CHECK ("claim"."confidence" >= 0 and "claim"."confidence" <= 1),
	CONSTRAINT "claim_review_status_check" CHECK ("claim"."review_status" = 'proposed')
);
--> statement-breakpoint
CREATE TABLE "duplicate_suggestion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_campaign_id" uuid NOT NULL,
	"left_candidate_id" uuid NOT NULL,
	"right_candidate_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"strength" text NOT NULL,
	"score" double precision NOT NULL,
	"signals" jsonb NOT NULL,
	"matcher_version" text NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_suggestion_distinct_check" CHECK ("duplicate_suggestion"."left_candidate_id" <> "duplicate_suggestion"."right_candidate_id"),
	CONSTRAINT "duplicate_suggestion_relation_check" CHECK ("duplicate_suggestion"."relation" in ('same_property', 'same_provider')),
	CONSTRAINT "duplicate_suggestion_strength_check" CHECK ("duplicate_suggestion"."strength" in ('likely', 'possible')),
	CONSTRAINT "duplicate_suggestion_review_status_check" CHECK ("duplicate_suggestion"."review_status" = 'unreviewed')
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"source_record_key" text NOT NULL,
	"source_record_url" text,
	"content_sha256" text NOT NULL,
	"payload" jsonb NOT NULL,
	"redacted_fields" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"first_source_artifact_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_source_key_check" CHECK ("evidence"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania'))
);
--> statement-breakpoint
CREATE TABLE "source_artifact" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"dataset_version" text,
	"original_url" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"reuse_terms" text NOT NULL,
	"retention_policy" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_artifact_source_key_check" CHECK ("source_artifact"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania')),
	CONSTRAINT "source_artifact_reuse_terms_check" CHECK ("source_artifact"."reuse_terms" in ('odbl_1_0', 'ro_public_register_no_explicit_licence')),
	CONSTRAINT "source_artifact_retention_policy_check" CHECK ("source_artifact"."retention_policy" in ('full_record', 'personal_data_redacted'))
);
--> statement-breakpoint
ALTER TABLE "research_campaign" ALTER COLUMN "county" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "acquisition_run_record" ADD CONSTRAINT "acquisition_run_record_acquisition_run_id_acquisition_run_id_fk" FOREIGN KEY ("acquisition_run_id") REFERENCES "public"."acquisition_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_run_record" ADD CONSTRAINT "acquisition_run_record_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_run_record" ADD CONSTRAINT "acquisition_run_record_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_run" ADD CONSTRAINT "acquisition_run_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_run" ADD CONSTRAINT "acquisition_run_source_artifact_id_source_artifact_id_fk" FOREIGN KEY ("source_artifact_id") REFERENCES "public"."source_artifact"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquisition_run" ADD CONSTRAINT "acquisition_run_initiated_by_administrator_id_administrator_id_fk" FOREIGN KEY ("initiated_by_administrator_id") REFERENCES "public"."administrator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_latest_evidence_id_evidence_id_fk" FOREIGN KEY ("latest_evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_first_seen_run_id_acquisition_run_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."acquisition_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_last_seen_run_id_acquisition_run_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."acquisition_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_acquisition_run_id_acquisition_run_id_fk" FOREIGN KEY ("acquisition_run_id") REFERENCES "public"."acquisition_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_suggestion" ADD CONSTRAINT "duplicate_suggestion_research_campaign_id_research_campaign_id_fk" FOREIGN KEY ("research_campaign_id") REFERENCES "public"."research_campaign"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_suggestion" ADD CONSTRAINT "duplicate_suggestion_left_candidate_id_candidate_id_fk" FOREIGN KEY ("left_candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_suggestion" ADD CONSTRAINT "duplicate_suggestion_right_candidate_id_candidate_id_fk" FOREIGN KEY ("right_candidate_id") REFERENCES "public"."candidate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_first_source_artifact_id_source_artifact_id_fk" FOREIGN KEY ("first_source_artifact_id") REFERENCES "public"."source_artifact"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acquisition_run_record_run_evidence_unique" ON "acquisition_run_record" USING btree ("acquisition_run_id","evidence_id");--> statement-breakpoint
CREATE INDEX "acquisition_run_record_evidence_index" ON "acquisition_run_record" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "acquisition_run_campaign_started_index" ON "acquisition_run" USING btree ("research_campaign_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_campaign_source_record_unique" ON "candidate" USING btree ("research_campaign_id","source_key","source_record_key");--> statement-breakpoint
CREATE INDEX "candidate_campaign_screening_index" ON "candidate" USING btree ("research_campaign_id","screening_class");--> statement-breakpoint
CREATE INDEX "candidate_campaign_county_index" ON "candidate" USING btree ("research_campaign_id","county_code");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_candidate_evidence_target_method_unique" ON "claim" USING btree ("candidate_id","evidence_id","target","extraction_method");--> statement-breakpoint
CREATE INDEX "claim_evidence_index" ON "claim" USING btree ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_suggestion_pair_unique" ON "duplicate_suggestion" USING btree ("left_candidate_id","right_candidate_id","relation","matcher_version");--> statement-breakpoint
CREATE INDEX "duplicate_suggestion_campaign_index" ON "duplicate_suggestion" USING btree ("research_campaign_id","matcher_version","strength");--> statement-breakpoint
CREATE INDEX "duplicate_suggestion_right_index" ON "duplicate_suggestion" USING btree ("right_candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_source_record_content_unique" ON "evidence" USING btree ("source_key","source_record_key","content_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "source_artifact_source_sha256_unique" ON "source_artifact" USING btree ("source_key","sha256");