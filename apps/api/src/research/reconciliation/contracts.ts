import { z } from 'zod';

import { EVIDENCE_SOURCE_KEYS } from '../acquisition/source-record';

export const RULE_VERSION = 'grp-reconciliation@1';
export const CORPUS_VERSION = 'grp-reconciliation-corpus@2';
export const SEED = 'elpa-reconciliation-2026-10-22-v2';
export const ATTRIBUTES = [
  'sleeps_persons',
  'beds_count',
  'exclusive_rental',
  'yard_area_m2',
  'lawn',
  'outdoor_grill',
  'pool',
  'hot_tub',
  'sauna',
  'recreation',
  'parties_allowed',
  'max_daytime_guests',
  'pool_availability',
] as const;
export const attributeSchema = z.enum(ATTRIBUTES);
const timestamp = z.iso.datetime();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const validitySchema = z
  .object({
    from: timestamp.nullable(),
    until: timestamp.nullable(),
  })
  .strict()
  .refine(
    (v) => v.from === null || v.until === null || Date.parse(v.from) < Date.parse(v.until),
    'Invalid validity interval',
  );

/** A proposition is a comparison projection of a Claim, never a replacement Claim. */
export const propositionSchema = z
  .object({
    claimId: z.uuid(),
    candidateId: z.uuid(),
    evidenceId: z.uuid(),
    entityLevel: z.enum(['offer', 'provider', 'operating_location', 'image']),
    scope: z.enum(['advertised_accommodation', 'shared_facility', 'image_visible', 'unknown']),
    attribute: attributeSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
    unit: z.enum(['persons', 'beds', 'm2', 'ha']).nullable(),
    qualifiers: z
      .object({
        capacityBasis: z.enum([
          'official_classified',
          'advertised_overnight',
          'event_attendance',
          'beds',
          'unknown',
        ]),
        access: z.enum(['private', 'shared', 'unknown']),
        months: z.array(z.number().int().min(1).max(12)).min(1).max(12).nullable(),
        approximate: z.boolean(),
        ambiguous: z.boolean(),
      })
      .strict(),
    validity: validitySchema,
    observedAt: timestamp,
    acquiredAt: timestamp,
    sourcePublishedAt: timestamp.nullable(),
    extractedAt: timestamp,
    method: z.string().min(1),
    methodStatus: z.enum(['current', 'superseded', 'unknown']),
    explicitness: z.enum(['explicit', 'inferred', 'unknown']),
    evidence: z
      .object({
        sourceKey: z.enum(EVIDENCE_SOURCE_KEYS),
        sourceRecordKey: z.string(),
        sourceVersion: z.string(),
        contentSha256: hash,
        originalId: z.string(),
        passageFingerprint: hash.nullable(),
        quote: z.string().nullable(),
        locator: z.record(z.string(), z.unknown()),
        grounding: z.enum(['valid', 'invalid', 'unvalidated']),
      })
      .strict(),
  })
  .strict();
export type Proposition = z.infer<typeof propositionSchema>;

export const lineageSchema = z
  .object({
    leftEvidenceId: z.uuid(),
    rightEvidenceId: z.uuid(),
    relation: z.enum(['common_origin', 'possibly_common_origin', 'independent']),
    basis: z.string().min(1),
    evidenceReferences: z.array(z.string().min(1)).min(1),
  })
  .strict();
export const caseSchema = z
  .object({
    id: hash,
    anchorCandidateId: z.uuid(),
    group: hash,
    partition: z.enum(['development', 'holdout']),
    stratum: z.enum(['reprocessed', 'cross_candidate', 'single_source']),
    candidateIds: z.array(z.uuid()).min(1).max(100),
    identity: z.literal('candidate_scoped_unresolved_cross_candidate'),
    identitySuggestionIds: z.array(z.uuid()),
    propositions: z.array(propositionSchema).max(200),
    lineage: z.array(lineageSchema).max(200),
  })
  .strict();
export type ReconciliationCase = z.infer<typeof caseSchema>;

export const RELATIONS = [
  'equivalent',
  'compatible',
  'conflicting',
  'not_comparable',
  'unresolved',
] as const;
export const pairSchema = z
  .object({
    leftClaimId: z.uuid(),
    rightClaimId: z.uuid(),
    attribute: attributeSchema,
    relation: z.enum(RELATIONS),
    rule: z.string(),
    lineage: z.enum(['common_origin', 'possibly_common_origin', 'independent', 'unknown']),
    identityConditional: z.boolean(),
    warnings: z.array(z.string()),
  })
  .strict();
export type PairAssessment = z.infer<typeof pairSchema>;
export const profileSchema = z
  .object({
    candidateId: z.uuid(),
    attribute: attributeSchema,
    claimIds: z.array(z.uuid()),
    support: z.enum(['supported', 'conflicted', 'insufficient_evidence', 'not_applicable']),
    corroboration: z.enum(['none', 'independent', 'possible_correlation']),
    temporal: z.enum(['historical', 'bounded_current', 'future', 'unknown', 'mixed']),
    freshness: z.enum(['within_review_window', 'stale', 'uncertain']),
    // All source assertions remain proposed; this is not a selected canonical value.
    supportedValues: z.array(z.union([z.string(), z.number(), z.boolean()])),
    uncertainties: z.array(z.string()),
  })
  .strict();
export const resultSchema = z
  .object({
    ruleVersion: z.string(),
    asOf: timestamp,
    inputDigest: hash,
    caseId: hash,
    status: z.literal('research_only'),
    evaluationStatus: z.literal('independent_review_pending'),
    pairs: z.array(pairSchema),
    profiles: z.array(profileSchema),
  })
  .strict();
export type ReconciliationResult = z.infer<typeof resultSchema>;
export const corpusSchema = z
  .object({
    version: z.enum(['grp-reconciliation-corpus@1', CORPUS_VERSION]),
    campaignId: z.uuid(),
    asOf: timestamp,
    frameDigest: hash,
    cases: z.array(caseSchema).max(48),
    evidenceSnapshots: z.array(
      z
        .object({
          id: z.uuid(),
          contentSha256: hash,
          sourceKey: z.string(),
          sourceRecordKey: z.string(),
          sourceRecordUrl: z.string().nullable(),
          sourceVersion: z.string(),
          reuseTerms: z.string(),
          retentionPolicy: z.string(),
          artifactSha256: hash,
          fields: z.array(
            z.object({ path: z.array(z.string()), text: z.string(), section: z.string() }),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type ReconciliationCorpus = z.infer<typeof corpusSchema>;
