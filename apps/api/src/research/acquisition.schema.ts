import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { administrators } from '../access/access.schema';
import { exactJsonb } from '../database/json-column';
import { timestampColumns } from '../database/timestamps';
import type {
  EvidenceLocator,
  JsonObject,
  JsonValue,
  RecordError,
} from './acquisition/source-record';
import { researchCampaigns } from './research.schema';

const sourceKeyCheck = (column: unknown) =>
  sql`${column} in ('situr_accommodation_register', 'osm_geofabrik_romania', 'overture_places')`;

/**
 * A versioned file obtained from a source. Identified by checksum; the
 * dataset version is read from the artifact itself during the first import.
 */
export const sourceArtifacts = pgTable(
  'source_artifact',
  {
    id: uuid('id').primaryKey(),
    sourceKey: text('source_key').notNull(),
    datasetVersion: text('dataset_version'),
    originalUrl: text('original_url').notNull(),
    fileName: text('file_name').notNull(),
    mediaType: text('media_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    reuseTerms: text('reuse_terms').notNull(),
    retentionPolicy: text('retention_policy').notNull(),
    metadata: jsonb('metadata').$type<JsonObject>().notNull().default({}),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('source_artifact_source_sha256_unique').on(table.sourceKey, table.sha256),
    check('source_artifact_source_key_check', sourceKeyCheck(table.sourceKey)),
    check(
      'source_artifact_reuse_terms_check',
      sql`${table.reuseTerms} in ('odbl_1_0', 'ro_public_register_no_explicit_licence', 'cdla_permissive_2_0')`,
    ),
    check(
      'source_artifact_retention_policy_check',
      sql`${table.retentionPolicy} in ('full_record', 'personal_data_redacted')`,
    ),
  ],
);

/** One recorded attempt to import a source artifact for a Research Campaign. */
export const acquisitionRuns = pgTable(
  'acquisition_run',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'restrict' }),
    sourceKey: text('source_key').notNull(),
    sourceArtifactId: uuid('source_artifact_id')
      .notNull()
      .references(() => sourceArtifacts.id, { onDelete: 'restrict' }),
    stage: text('stage').notNull(),
    parserVersion: text('parser_version').notNull(),
    normalizerVersion: text('normalizer_version').notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    initiatedByAdministratorId: uuid('initiated_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    stats: jsonb('stats').$type<JsonObject>().notNull().default({}),
    outputDigest: text('output_digest'),
    failure: jsonb('failure').$type<{ code: string; message: string }>(),
    ...timestampColumns(),
  },
  (table) => [
    index('acquisition_run_campaign_started_index').on(table.researchCampaignId, table.startedAt),
    check('acquisition_run_source_key_check', sourceKeyCheck(table.sourceKey)),
    check('acquisition_run_stage_check', sql`${table.stage} in ('import', 'extract')`),
    check(
      'acquisition_run_status_check',
      sql`${table.status} in ('running', 'succeeded', 'completed_with_rejections', 'failed')`,
    ),
  ],
);

/**
 * Immutable source content for one source record. A changed record produces a
 * new row; identical content observed again is reused, never overwritten.
 */
export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey(),
    sourceKey: text('source_key').notNull(),
    sourceRecordKey: text('source_record_key').notNull(),
    sourceRecordUrl: text('source_record_url'),
    contentSha256: text('content_sha256').notNull(),
    payload: jsonb('payload').$type<JsonObject>().notNull(),
    redactedFields: text('redacted_fields')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    firstSourceArtifactId: uuid('first_source_artifact_id')
      .notNull()
      .references(() => sourceArtifacts.id, { onDelete: 'restrict' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('evidence_source_record_content_unique').on(
      table.sourceKey,
      table.sourceRecordKey,
      table.contentSha256,
    ),
    check('evidence_source_key_check', sourceKeyCheck(table.sourceKey)),
  ],
);

/** What one Acquisition Run read for one source record, and how it was interpreted. */
export const acquisitionRunRecords = pgTable(
  'acquisition_run_record',
  {
    id: uuid('id').primaryKey(),
    acquisitionRunId: uuid('acquisition_run_id')
      .notNull()
      .references(() => acquisitionRuns.id, { onDelete: 'restrict' }),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    evidenceOutcome: text('evidence_outcome').notNull(),
    extractionStatus: text('extraction_status').notNull(),
    errors: jsonb('errors').$type<RecordError[]>().notNull().default([]),
    inCampaignScope: boolean('in_campaign_scope').notNull(),
    candidateId: uuid('candidate_id').references(() => candidates.id, { onDelete: 'restrict' }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('acquisition_run_record_run_evidence_unique').on(
      table.acquisitionRunId,
      table.evidenceId,
    ),
    index('acquisition_run_record_evidence_index').on(table.evidenceId),
    check(
      'acquisition_run_record_evidence_outcome_check',
      sql`${table.evidenceOutcome} in ('created', 'unchanged')`,
    ),
    check(
      'acquisition_run_record_extraction_status_check',
      sql`${table.extractionStatus} in ('parsed', 'rejected')`,
    ),
  ],
);

/**
 * An unverified possible Offer discovered by a Research Campaign from one
 * source record. The display and screening columns are a convenience
 * projection of the latest Claims; Claims remain the source of truth.
 */
export const candidates = pgTable(
  'candidate',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'restrict' }),
    sourceKey: text('source_key').notNull(),
    sourceRecordKey: text('source_record_key').notNull(),
    kind: text('kind').notNull(),
    verificationStatus: text('verification_status').notNull().default('unverified'),
    latestEvidenceId: uuid('latest_evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    displayName: text('display_name').notNull(),
    countyCode: text('county_code'),
    settlementName: text('settlement_name'),
    screeningClass: text('screening_class').notNull(),
    firstSeenRunId: uuid('first_seen_run_id')
      .notNull()
      .references(() => acquisitionRuns.id, { onDelete: 'restrict' }),
    lastSeenRunId: uuid('last_seen_run_id')
      .notNull()
      .references(() => acquisitionRuns.id, { onDelete: 'restrict' }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('candidate_campaign_source_record_unique').on(
      table.researchCampaignId,
      table.sourceKey,
      table.sourceRecordKey,
    ),
    index('candidate_campaign_screening_index').on(table.researchCampaignId, table.screeningClass),
    index('candidate_campaign_county_index').on(table.researchCampaignId, table.countyCode),
    check('candidate_source_key_check', sourceKeyCheck(table.sourceKey)),
    check('candidate_kind_check', sql`${table.kind} in ('offer')`),
    // Research cannot verify: Verification Decisions belong to Curation (ADR 0013).
    check('candidate_verification_status_check', sql`${table.verificationStatus} = 'unverified'`),
    check(
      'candidate_screening_class_check',
      sql`${table.screeningClass} in ('plausible', 'ambiguous', 'out_of_scope', 'insufficient_data')`,
    ),
  ],
);

/** An immutable, source-attributed proposed value about a Candidate. */
export const claims = pgTable(
  'claim',
  {
    id: uuid('id').primaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'restrict' }),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'restrict' }),
    acquisitionRunId: uuid('acquisition_run_id')
      .notNull()
      .references(() => acquisitionRuns.id, { onDelete: 'restrict' }),
    target: text('target').notNull(),
    value: exactJsonb('value').$type<JsonValue>().notNull(),
    evidenceLocator: jsonb('evidence_locator').$type<EvidenceLocator>().notNull(),
    extractionMethod: text('extraction_method').notNull(),
    observationKey: text('observation_key').notNull().default(''),
    confidence: doublePrecision('confidence').notNull(),
    reviewStatus: text('review_status').notNull().default('proposed'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('claim_candidate_evidence_target_method_observation_unique').on(
      table.candidateId,
      table.evidenceId,
      table.target,
      table.extractionMethod,
      table.observationKey,
    ),
    index('claim_evidence_index').on(table.evidenceId),
    check('claim_confidence_check', sql`${table.confidence} >= 0 and ${table.confidence} <= 1`),
    check('claim_review_status_check', sql`${table.reviewStatus} = 'proposed'`),
  ],
);

/**
 * An explainable suggestion that two Candidates may describe the same
 * property or the same Provider. Suggestions never merge records.
 */
export const duplicateSuggestions = pgTable(
  'duplicate_suggestion',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'restrict' }),
    leftCandidateId: uuid('left_candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'restrict' }),
    rightCandidateId: uuid('right_candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'restrict' }),
    relation: text('relation').notNull(),
    strength: text('strength').notNull(),
    score: doublePrecision('score').notNull(),
    signals: jsonb('signals').$type<JsonObject>().notNull(),
    matcherVersion: text('matcher_version').notNull(),
    reviewStatus: text('review_status').notNull().default('unreviewed'),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('duplicate_suggestion_pair_unique').on(
      table.leftCandidateId,
      table.rightCandidateId,
      table.relation,
      table.matcherVersion,
    ),
    index('duplicate_suggestion_campaign_index').on(
      table.researchCampaignId,
      table.matcherVersion,
      table.strength,
    ),
    index('duplicate_suggestion_right_index').on(table.rightCandidateId),
    check(
      'duplicate_suggestion_distinct_check',
      sql`${table.leftCandidateId} <> ${table.rightCandidateId}`,
    ),
    check(
      'duplicate_suggestion_relation_check',
      sql`${table.relation} in ('same_property', 'same_provider')`,
    ),
    check('duplicate_suggestion_strength_check', sql`${table.strength} in ('likely', 'possible')`),
    check('duplicate_suggestion_review_status_check', sql`${table.reviewStatus} = 'unreviewed'`),
  ],
);
