import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OVERRIDE_OUTCOMES } from '../verification-persistence';
import {
  CATEGORY_IDS,
  IMPLEMENTED_METHODS,
  OUTCOMES,
  RECOMMENDATIONS,
  STRATEGIES,
  VERIFICATION_METHODS,
  assessmentSchema,
  categorySchema,
  followUpSchema,
  validationSchema,
} from '../verification/contracts';

export const VerificationDecisionSchema = z
  .object({
    id: z.uuid(),
    claimId: z.uuid(),
    target: z.string().nullable(),
    claimValue: z.unknown(),
    /** The Claim's method or Evidence was superseded after the decision. */
    claimSuperseded: z.boolean(),
    category: categorySchema.nullable(),
    risk: z.enum(['lower', 'moderate', 'higher']).nullable(),
    method: z.enum(IMPLEMENTED_METHODS),
    outcome: z.enum(OUTCOMES),
    recommendation: z.enum(RECOMMENDATIONS).nullable(),
    policyVersion: z.string(),
    strategy: z.enum(STRATEGIES).nullable(),
    evidenceScore: z.number().int().nullable(),
    reasons: z.array(z.string()),
    conditions: z.array(z.string()),
    proposition: validationSchema.shape.proposition,
    validation: validationSchema.nullable(),
    assessment: assessmentSchema.nullable(),
    followUp: followUpSchema.nullable(),
    eligibilityId: z.uuid().nullable(),
    overrideReason: z.string().nullable(),
    supersedesDecisionId: z.uuid().nullable(),
    supersededBy: z.uuid().nullable(),
    decidedAt: z.iso.datetime(),
    asOf: z.iso.datetime(),
    publication: z.object({ status: z.literal('blocked'), reasons: z.array(z.string()) }).strict(),
  })
  .strict()
  .meta({ id: 'VerificationDecision' });
export type VerificationDecisionView = z.infer<typeof VerificationDecisionSchema>;
export const VerificationDecisionListSchema = z
  .array(VerificationDecisionSchema)
  .meta({ id: 'VerificationDecisionList' });
export class VerificationDecisionListDto extends createZodDto(VerificationDecisionListSchema) {}

const metricsSchema = z
  .object({
    autoApprovals: z.number().int(),
    falseApprovals: z.number().int(),
    labeled: z.number().int(),
    precision: z.number().nullable(),
    falseApprovalUpper: z.number().nullable(),
  })
  .strict();

export const VerificationPolicySchema = z
  .object({
    version: z.string(),
    categories: z.array(
      z
        .object({
          id: categorySchema,
          risk: z.enum(['lower', 'moderate', 'higher']),
          proposition: z.string(),
          intendedUse: z.string(),
          evidenceRequirements: z.array(z.string()),
          autonomy: z.enum(['gated', 'never']),
          corroboration: z.enum(['not_required', 'independent_required']),
          assessor: z.enum(['not_required', 'advisory', 'required']),
          publicationMethods: z.array(z.enum(VERIFICATION_METHODS)),
          freshnessDays: z.number().int(),
          gate: z
            .object({
              minAccepted: z.number().int(),
              maxFalseApprovalPoint: z.number(),
              maxFalseApprovalUpper: z.number(),
              minAgreement: z.number(),
              minReviewers: z.number().int(),
            })
            .strict()
            .nullable(),
          eligibility: z
            .object({ id: z.uuid(), threshold: z.number().int(), approvedAt: z.iso.datetime() })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
    evaluation: z
      .object({
        id: z.uuid(),
        evaluatedAt: z.iso.datetime(),
        status: z.string(),
        reviewers: z.number().int(),
        labeledItems: z.number().int(),
        gates: z.record(
          z.enum(CATEGORY_IDS),
          z.object({ passed: z.boolean(), reasons: z.array(z.string()) }).strict(),
        ),
        holdout: z.record(z.enum(CATEGORY_IDS), metricsSchema),
        strategies: z.record(
          z.enum(STRATEGIES),
          z
            .object({
              recommendations: z.record(z.string(), z.number().int()),
              assessmentCalls: z.number().int(),
              assessmentCostUsd: z.number(),
              assessmentLatencyMs: z.number(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .meta({ id: 'VerificationPolicy' });
export type VerificationPolicyView = z.infer<typeof VerificationPolicySchema>;
export class VerificationPolicyDto extends createZodDto(VerificationPolicySchema) {}

export const CandidateVerificationParamsSchema = z
  .object({ campaignId: z.uuid(), candidateId: z.uuid() })
  .strict();
export class CandidateVerificationParamsDto extends createZodDto(
  CandidateVerificationParamsSchema,
) {}

export const DecisionParamsSchema = z.object({ decisionId: z.uuid() }).strict();
export class DecisionParamsDto extends createZodDto(DecisionParamsSchema) {}

export const VerificationOverrideSchema = z
  .object({
    outcome: z.enum(OVERRIDE_OUTCOMES),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict()
  .meta({ id: 'VerificationOverride' });
export class VerificationOverrideDto extends createZodDto(VerificationOverrideSchema) {}
