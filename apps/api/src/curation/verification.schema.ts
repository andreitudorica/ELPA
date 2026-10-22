import { sql } from 'drizzle-orm';
import {
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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { administrators } from '../access/access.schema';
import { timestampColumns } from '../database/timestamps';
import { candidates, claims } from '../research/acquisition.schema';
import { researchCampaigns } from '../research/research.schema';

/** A scored evaluation of the verification policy; aggregates only, never review sheets. */
export const verificationEvaluations = pgTable(
  'verification_evaluation',
  {
    id: uuid('id').primaryKey(),
    policyVersion: text('policy_version').notNull(),
    corpusDigest: text('corpus_digest').notNull(),
    reportDigest: text('report_digest').notNull(),
    report: jsonb('report').$type<Record<string, unknown>>().notNull(),
    evaluatedByAdministratorId: uuid('evaluated_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('verification_evaluation_report_unique').on(
      table.policyVersion,
      table.corpusDigest,
      table.reportDigest,
    ),
  ],
);

/**
 * An Administrator's approval that one category passed its predeclared gate.
 * Without an active row, the policy can only recommend machine verification.
 */
export const verificationEligibility = pgTable(
  'verification_eligibility',
  {
    id: uuid('id').primaryKey(),
    policyVersion: text('policy_version').notNull(),
    category: text('category').notNull(),
    evaluationId: uuid('evaluation_id')
      .notNull()
      .references(() => verificationEvaluations.id, { onDelete: 'restrict' }),
    threshold: integer('threshold').notNull(),
    acceptedHoldout: integer('accepted_holdout').notNull(),
    falseApprovalUpper: doublePrecision('false_approval_upper').notNull(),
    reviewers: integer('reviewers').notNull(),
    approvedByAdministratorId: uuid('approved_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('verification_eligibility_active_unique')
      .on(table.policyVersion, table.category)
      .where(sql`${table.revokedAt} is null`),
    check(
      'verification_eligibility_category_check',
      sql`${table.category} in ('register_locality', 'osm_county', 'register_classified_capacity', 'explicit_text_facility', 'property_shape_count')`,
    ),
    check('verification_eligibility_reviewers_check', sql`${table.reviewers} >= 2`),
    check('verification_eligibility_sample_check', sql`${table.acceptedHoldout} >= 100`),
    check(
      'verification_eligibility_error_bound_check',
      sql`${table.falseApprovalUpper} >= 0 and ${table.falseApprovalUpper} <= 0.05`,
    ),
  ],
);

/**
 * One Verification Decision about one Claim, append-only. The method records
 * who or what decided; a machine decision is never presented as a human one.
 */
export const verificationDecisions = pgTable(
  'verification_decision',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'restrict' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'restrict' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'restrict' }),
    category: text('category'),
    method: text('method').notNull(),
    outcome: text('outcome').notNull(),
    recommendation: text('recommendation'),
    policyVersion: text('policy_version').notNull(),
    strategy: text('strategy'),
    eligibilityId: uuid('eligibility_id').references(() => verificationEligibility.id, {
      onDelete: 'restrict',
    }),
    supersedesDecisionId: uuid('supersedes_decision_id').references(
      (): AnyPgColumn => verificationDecisions.id,
      { onDelete: 'restrict' },
    ),
    evidenceIds: uuid('evidence_ids').array().notNull(),
    inputClaimIds: uuid('input_claim_ids').array().notNull(),
    /** Validation, assessment, follow-up and reasons exactly as the decision used them. */
    basis: jsonb('basis').$type<Record<string, unknown>>().notNull(),
    evidenceScore: integer('evidence_score'),
    overrideReason: text('override_reason'),
    inputDigest: text('input_digest').notNull(),
    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
    decidedByAdministratorId: uuid('decided_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    publication: text('publication').notNull().default('separate_decision_required'),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('verification_decision_input_unique').on(
      table.claimId,
      table.policyVersion,
      table.method,
      table.inputDigest,
    ),
    index('verification_decision_candidate_index').on(table.candidateId, table.decidedAt),
    check(
      'verification_decision_method_check',
      sql`${table.method} in ('machine_policy', 'administrator')`,
    ),
    check(
      'verification_decision_outcome_check',
      sql`${table.outcome} in ('verified', 'further_research_required', 'insufficient_evidence', 'contradicted', 'not_eligible', 'rejected')`,
    ),
    // Machine verification requires an approved, evaluated eligibility.
    check(
      'verification_decision_machine_eligibility_check',
      sql`not (${table.method} = 'machine_policy' and ${table.outcome} = 'verified') or ${table.eligibilityId} is not null`,
    ),
    check(
      'verification_decision_high_consequence_check',
      sql`not (${table.method} = 'machine_policy' and ${table.outcome} = 'verified' and ${table.category} = 'high_consequence')`,
    ),
    check(
      'verification_decision_override_reason_check',
      sql`${table.method} <> 'administrator' or (${table.overrideReason} is not null and length(trim(${table.overrideReason})) >= 10)`,
    ),
    check(
      'verification_decision_rejection_check',
      sql`${table.outcome} <> 'rejected' or ${table.method} = 'administrator'`,
    ),
    // Publication is a separate, not yet implemented Curation decision.
    check(
      'verification_decision_publication_check',
      sql`${table.publication} = 'separate_decision_required'`,
    ),
  ],
);
