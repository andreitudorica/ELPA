import { z } from 'zod';

export const POLICY_VERSION = 'elpa-verification-policy@1';
export const VALIDATOR_VERSION = 'elpa-evidence-validator@1';
export const FOLLOW_UP_VERSION = 'elpa-follow-up-research@1';
export const CORPUS_VERSION = 'elpa-verification-corpus@2';
export const SEED = 'elpa-verification-2026-10-22';

export const CATEGORY_IDS = [
  'register_locality',
  'osm_county',
  'register_classified_capacity',
  'explicit_text_facility',
  'property_shape_count',
  'high_consequence',
] as const;
export const categorySchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof categorySchema>;

/** How a Verification Decision was reached; never collapsed into one "verified" state. */
export const VERIFICATION_METHODS = [
  'machine_policy',
  'administrator',
  'owner_confirmation',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
/** Methods with an implemented write path. Owner confirmation has no Evidence source yet. */
export const IMPLEMENTED_METHODS = ['machine_policy', 'administrator'] as const;

export const OUTCOMES = [
  'verified',
  'further_research_required',
  'insufficient_evidence',
  'contradicted',
  'not_eligible',
  'rejected',
] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const RECOMMENDATIONS = [
  'auto_verify',
  'further_research_required',
  'insufficient_evidence',
  'contradicted',
  'not_eligible',
] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];
export const STRATEGIES = ['A', 'B', 'C'] as const;
export type Strategy = (typeof STRATEGIES)[number];
export const SPLITS = ['development', 'calibration', 'holdout'] as const;
export type Split = (typeof SPLITS)[number];

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime();
const propositionValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.union([z.string(), z.null()])),
]);

export const fieldSchema = z
  .object({
    path: z.array(z.string()).min(1),
    text: z.string().nullable(),
    withheld: z.enum(['none', 'redacted', 'possible_contact', 'missing', 'not_readable']),
  })
  .strict();

export const claimSnapshotSchema = z
  .object({
    claimId: z.uuid(),
    candidateId: z.uuid(),
    evidenceId: z.uuid(),
    target: z.string(),
    value: z.json(),
    locator: z.record(z.string(), z.json()),
    method: z.string(),
    methodCurrent: z.boolean(),
    evidenceLatest: z.boolean(),
    grounding: z.enum(['valid', 'invalid', 'not_applicable']),
    observedAt: timestamp,
    extractedAt: timestamp,
  })
  .strict();
export type ClaimSnapshot = z.infer<typeof claimSnapshotSchema>;

export const evidenceSnapshotSchema = z
  .object({
    id: z.uuid(),
    sourceKey: z.string(),
    sourceRecordKey: z.string(),
    contentSha256: hash,
    fields: z.array(fieldSchema),
    artifact: z
      .object({
        id: z.uuid(),
        sha256: hash,
        datasetVersion: z.string().nullable(),
        latestDatasetVersion: z.string().nullable(),
        retrievedAt: timestamp,
        reuseTerms: z.string(),
        retentionPolicy: z.string(),
      })
      .strict(),
  })
  .strict();
export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>;

const candidateSchema = z
  .object({
    id: z.uuid(),
    sourceKey: z.string(),
    sourceRecordKey: z.string(),
    displayName: z.string(),
  })
  .strict();

/** Everything one verification decision may rely on, pinned at export time. */
export const subjectSchema = z
  .object({
    itemId: hash,
    category: categorySchema.nullable(),
    candidate: candidateSchema,
    claim: claimSnapshotSchema,
    /** Other Claims about the same Candidate and target, including superseded ones. */
    siblings: z.array(claimSnapshotSchema),
    /** Same-property Duplicate Suggestions: unreviewed, so every comparison is conditional. */
    counterparts: z.array(
      z
        .object({
          suggestionId: z.uuid(),
          strength: z.enum(['likely', 'possible']),
          candidate: candidateSchema,
          claims: z.array(claimSnapshotSchema),
        })
        .strict(),
    ),
    evidence: z.array(evidenceSnapshotSchema),
    conditions: z.array(z.string()),
  })
  .strict();
export type Subject = z.infer<typeof subjectSchema>;

export const CHECK_IDS = [
  'evidence_exists',
  'processing_permitted',
  'source_reference_valid',
  'support_present',
  'identity_established',
  'scope_correct',
  'value_normalized',
  'temporal_context',
  'contradictions_checked',
  'independence_assessed',
] as const;
export const lineageSchema = z.enum([
  'common_origin',
  'possibly_common_origin',
  'independent',
  'unknown',
]);
export const relatedClaimSchema = z
  .object({
    claimId: z.uuid(),
    candidateId: z.uuid(),
    evidenceId: z.uuid(),
    sourceKey: z.string(),
    conditional: z.boolean(),
    lineage: lineageSchema,
  })
  .strict();
export const validationSchema = z
  .object({
    validatorVersion: z.literal(VALIDATOR_VERSION),
    itemId: hash,
    category: categorySchema.nullable(),
    outcome: z.enum(['passed', 'deferred', 'contradicted', 'rejected']),
    proposition: z.object({ attribute: z.string(), value: propositionValue }).strict().nullable(),
    checks: z.array(
      z
        .object({
          id: z.enum(CHECK_IDS),
          status: z.enum(['pass', 'warn', 'fail', 'not_applicable']),
          reasons: z.array(z.string()),
        })
        .strict(),
    ),
    conflicts: z.array(relatedClaimSchema),
    corroboration: z.array(relatedClaimSchema),
    publicationConstraints: z.array(z.string()),
    aiTransfer: z.object({ permitted: z.boolean(), reasons: z.array(z.string()) }).strict(),
    reasons: z.array(z.string()),
  })
  .strict();
export type Validation = z.infer<typeof validationSchema>;

export const ASSESSMENT_VERDICTS = [
  'supported',
  'contradicted',
  'insufficient_evidence',
  'incorrect_entity_attribution',
  'uncertain',
] as const;
export const CONCERNS = [
  'negation',
  'seasonal_or_temporal',
  'shared_or_public_facility',
  'different_property',
  'different_capacity_basis',
  'outdated',
  'ambiguous_wording',
  'none',
] as const;

/**
 * The structured output requested from a model. Field names are snake_case
 * because they are part of the prompt. Self-reported confidence is not requested.
 */
export const modelOutputSchema = z
  .object({
    verdict: z.enum(ASSESSMENT_VERDICTS),
    rationale: z.string(),
    supporting_evidence_ids: z.array(z.string()),
    contradicting_evidence_ids: z.array(z.string()),
    supporting_quotes: z.array(z.object({ evidence_id: z.string(), quote: z.string() }).strict()),
    concerns: z.array(z.enum(CONCERNS)),
  })
  .strict();
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** One model call as captured, before any validation; failures are kept, never retried silently. */
export const capturedAssessmentSchema = z
  .object({
    itemId: hash,
    requestSha256: hash,
    provider: z.string().min(1),
    model: z.string().min(1),
    servedModel: z.string().nullable(),
    promptVersion: z.string(),
    promptSha256: hash,
    parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    stopReason: z.string().nullable(),
    output: z.json().nullable(),
    latencyMs: z.number().nonnegative(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    cacheReadTokens: z.number().int().nonnegative().nullable(),
    costUsd: z.number().nonnegative().nullable(),
    executedAt: timestamp,
    error: z.object({ type: z.string(), status: z.number().nullable() }).strict().nullable(),
  })
  .strict();
export type CapturedAssessment = z.infer<typeof capturedAssessmentSchema>;

export const assessmentSchema = z
  .object({
    status: z.enum(['accepted', 'rejected', 'unavailable']),
    verdict: z.enum(ASSESSMENT_VERDICTS).nullable(),
    errors: z.array(z.string()),
    rationale: z.string().nullable(),
    supportingEvidenceIds: z.array(z.uuid()),
    contradictingEvidenceIds: z.array(z.uuid()),
    concerns: z.array(z.enum(CONCERNS)),
    model: z.string().nullable(),
    promptVersion: z.string().nullable(),
    costUsd: z.number().nonnegative().nullable(),
    latencyMs: z.number().nonnegative().nullable(),
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;

export const followUpSchema = z
  .object({
    version: z.literal(FOLLOW_UP_VERSION),
    actions: z.array(
      z
        .object({
          action: z.enum([
            'reread_retained_evidence',
            'consult_register_counterpart',
            'request_new_observation',
          ]),
          fingerprint: z.string(),
          result: z.enum(['agrees', 'disagrees', 'absent', 'not_permitted', 'not_applicable']),
          detail: z.string(),
        })
        .strict(),
    ),
    networkCalls: z.literal(0),
    costUsd: z.literal(0),
    termination: z.enum(['resolved', 'contradicted', 'exhausted', 'not_applicable']),
  })
  .strict();
export type FollowUp = z.infer<typeof followUpSchema>;

export const decisionSchema = z
  .object({
    itemId: hash,
    claimId: z.uuid(),
    candidateId: z.uuid(),
    category: categorySchema.nullable(),
    policyVersion: z.literal(POLICY_VERSION),
    strategy: z.enum(STRATEGIES),
    recommendation: z.enum(RECOMMENDATIONS),
    outcome: z.enum(OUTCOMES),
    reasons: z.array(z.string()),
    /** Ordinal evidence strength used for selective prediction; not a probability. */
    evidenceScore: z.number().int().min(0).max(5),
    assessmentUsed: z.boolean(),
    eligibilityId: z.uuid().nullable(),
  })
  .strict();
export type Decision = z.infer<typeof decisionSchema>;

export const GOLD_LABELS = [
  'supported',
  'contradicted',
  'insufficient_evidence',
  'incorrect_entity_attribution',
  'outdated',
  'ambiguous',
] as const;
export type GoldLabel = (typeof GOLD_LABELS)[number];

/** Blind independent review of exported items; developer or model labels are rejected. */
export const reviewSchema = z
  .object({
    corpusDigest: hash,
    reviewerId: z.string().min(1),
    reviewerKind: z.literal('independent_human'),
    independenceStatement: z.string().min(20),
    labels: z.array(
      z
        .object({
          itemId: hash,
          label: z.enum(GOLD_LABELS),
          evidenceInspected: z.array(z.string()).min(1),
          rationale: z.string().min(1),
          seconds: z.number().nonnegative().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;

export const adjudicationSchema = z
  .object({
    corpusDigest: hash,
    adjudicatorId: z.string().min(1),
    decisions: z.array(
      z.object({ itemId: hash, label: z.enum(GOLD_LABELS), rationale: z.string().min(1) }).strict(),
    ),
  })
  .strict();
export type Adjudication = z.infer<typeof adjudicationSchema>;

export const corpusItemSchema = z
  .object({
    subject: subjectSchema,
    split: z.enum(SPLITS),
    stratum: z.string(),
    /** Population records represented by one sampled item of its stratum. */
    weight: z.number().positive(),
    group: hash,
    /** Item was a holdout member of an earlier experiment and cannot inform development. */
    priorHoldout: z.boolean(),
  })
  .strict();
export const corpusSchema = z
  .object({
    version: z.literal(CORPUS_VERSION),
    policyVersion: z.literal(POLICY_VERSION),
    campaignId: z.uuid(),
    asOf: timestamp,
    seed: z.literal(SEED),
    frameDigest: hash,
    items: z.array(corpusItemSchema),
  })
  .strict();
export type Corpus = z.infer<typeof corpusSchema>;
export type CorpusItem = z.infer<typeof corpusItemSchema>;

/** Per-item run output kept privately for scoring. */
export const scoringItemSchema = z
  .object({
    itemId: hash,
    split: z.enum(SPLITS),
    category: categorySchema.nullable(),
    sourceKey: z.string(),
    conditions: z.array(z.string()),
    decisions: z.object({ A: decisionSchema, B: decisionSchema, C: decisionSchema }).strict(),
    assessment: assessmentSchema,
    followUp: followUpSchema.nullable(),
  })
  .strict();
