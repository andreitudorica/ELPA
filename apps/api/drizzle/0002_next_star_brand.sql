ALTER TABLE "acquisition_run" DROP CONSTRAINT "acquisition_run_source_key_check";--> statement-breakpoint
ALTER TABLE "candidate" DROP CONSTRAINT "candidate_source_key_check";--> statement-breakpoint
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_source_key_check";--> statement-breakpoint
ALTER TABLE "source_artifact" DROP CONSTRAINT "source_artifact_source_key_check";--> statement-breakpoint
ALTER TABLE "source_artifact" DROP CONSTRAINT "source_artifact_reuse_terms_check";--> statement-breakpoint
ALTER TABLE "acquisition_run" ADD CONSTRAINT "acquisition_run_source_key_check" CHECK ("acquisition_run"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania', 'overture_places'));--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_source_key_check" CHECK ("candidate"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania', 'overture_places'));--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_key_check" CHECK ("evidence"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania', 'overture_places'));--> statement-breakpoint
ALTER TABLE "source_artifact" ADD CONSTRAINT "source_artifact_source_key_check" CHECK ("source_artifact"."source_key" in ('situr_accommodation_register', 'osm_geofabrik_romania', 'overture_places'));--> statement-breakpoint
ALTER TABLE "source_artifact" ADD CONSTRAINT "source_artifact_reuse_terms_check" CHECK ("source_artifact"."reuse_terms" in ('odbl_1_0', 'ro_public_register_no_explicit_licence', 'cdla_permissive_2_0'));