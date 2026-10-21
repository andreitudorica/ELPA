ALTER TABLE "acquisition_run" DROP CONSTRAINT "acquisition_run_stage_check";--> statement-breakpoint
DROP INDEX "claim_candidate_evidence_target_method_unique";--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "observation_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_candidate_evidence_target_method_observation_unique" ON "claim" USING btree ("candidate_id","evidence_id","target","extraction_method","observation_key");--> statement-breakpoint
ALTER TABLE "acquisition_run" ADD CONSTRAINT "acquisition_run_stage_check" CHECK ("acquisition_run"."stage" in ('import', 'extract'));