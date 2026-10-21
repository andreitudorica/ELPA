import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SCREENING_CLASSES, SOURCE_KEYS } from '../acquisition/source-record';

/**
 * Administrative projections of the acquisition experiment. Every Candidate,
 * Claim, and suggestion here is unverified research data: the literal
 * `verificationStatus`, `reviewStatus` values encode that in the contract.
 */
const SourceKeySchema = z.enum(SOURCE_KEYS);
const ScreeningClassSchema = z.enum(SCREENING_CLASSES);
const JsonObjectSchema = z.record(z.string(), z.unknown());
const CountsSchema = z.record(z.string(), z.number());
const isoDateTime = z.iso.datetime();

export const CampaignParamsSchema = z.object({ campaignId: z.uuid() });
export class CampaignParamsDto extends createZodDto(CampaignParamsSchema) {}

export const CandidateParamsSchema = z.object({ campaignId: z.uuid(), candidateId: z.uuid() });
export class CandidateParamsDto extends createZodDto(CandidateParamsSchema) {}

export const AcquisitionRunSchema = z
  .object({
    id: z.uuid(),
    sourceKey: SourceKeySchema,
    stage: z.enum(['import', 'extract']),
    status: z.enum(['running', 'succeeded', 'completed_with_rejections', 'failed']),
    parserVersion: z.string(),
    normalizerVersion: z.string(),
    startedAt: isoDateTime,
    completedAt: isoDateTime.nullable(),
    outputDigest: z.string().nullable(),
    failure: z.object({ code: z.string(), message: z.string() }).nullable(),
    stats: JsonObjectSchema,
    artifact: z.object({
      sha256: z.string(),
      datasetVersion: z.string().nullable(),
      originalUrl: z.string(),
      fileName: z.string(),
      byteSize: z.number().int(),
      retrievedAt: isoDateTime,
      reuseTerms: z.string(),
      retentionPolicy: z.string(),
    }),
  })
  .meta({ id: 'AcquisitionRun' });

export const AcquisitionRunListSchema = z
  .array(AcquisitionRunSchema)
  .meta({ id: 'AcquisitionRunList' });
export class AcquisitionRunListDto extends createZodDto(AcquisitionRunListSchema) {}

const page = z.coerce.number().int().min(1).max(100_000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);

export const CandidateQuerySchema = z.object({
  source: SourceKeySchema.optional(),
  screening: ScreeningClassSchema.optional(),
  county: z
    .string()
    .regex(/^RO-[A-Z]{1,2}$/)
    .optional(),
  search: z.string().trim().min(1).max(100).optional(),
  match: z.enum(['with_suggestions', 'without_suggestions']).optional(),
  page,
  pageSize,
});
export class CandidateQueryDto extends createZodDto(CandidateQuerySchema) {}

export const CandidateSummarySchema = z
  .object({
    id: z.uuid(),
    sourceKey: SourceKeySchema,
    sourceRecordKey: z.string(),
    displayName: z.string(),
    countyCode: z.string().nullable(),
    settlementName: z.string().nullable(),
    screeningClass: ScreeningClassSchema,
    verificationStatus: z.literal('unverified'),
    suggestionCount: z.number().int(),
    updatedAt: isoDateTime,
  })
  .meta({ id: 'CandidateSummary' });

export const CandidatePageSchema = z
  .object({
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    items: z.array(CandidateSummarySchema),
  })
  .meta({ id: 'CandidatePage' });
export class CandidatePageDto extends createZodDto(CandidatePageSchema) {}

const CandidateReferenceSchema = z.object({
  id: z.uuid(),
  sourceKey: SourceKeySchema,
  displayName: z.string(),
  settlementName: z.string().nullable(),
  countyCode: z.string().nullable(),
});

export const DuplicateSuggestionSchema = z
  .object({
    id: z.uuid(),
    relation: z.enum(['same_property', 'same_provider']),
    strength: z.enum(['likely', 'possible']),
    score: z.number(),
    matcherVersion: z.string(),
    reviewStatus: z.literal('unreviewed'),
    signals: JsonObjectSchema,
    left: CandidateReferenceSchema,
    right: CandidateReferenceSchema,
  })
  .meta({ id: 'DuplicateSuggestion' });

export const SuggestionQuerySchema = z.object({
  relation: z.enum(['same_property', 'same_provider']).optional(),
  strength: z.enum(['likely', 'possible']).optional(),
  page,
  pageSize,
});
export class SuggestionQueryDto extends createZodDto(SuggestionQuerySchema) {}

export const DuplicateSuggestionPageSchema = z
  .object({
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    matcherVersion: z.string(),
    items: z.array(DuplicateSuggestionSchema),
  })
  .meta({ id: 'DuplicateSuggestionPage' });
export class DuplicateSuggestionPageDto extends createZodDto(DuplicateSuggestionPageSchema) {}

export const CandidateDetailSchema = z
  .object({
    candidate: CandidateSummarySchema.extend({
      kind: z.literal('offer'),
      sourceRecordUrl: z.string().nullable(),
      latestEvidenceId: z.uuid(),
      firstSeenRunId: z.uuid(),
      lastSeenRunId: z.uuid(),
      createdAt: isoDateTime,
    }),
    claims: z.array(
      z.object({
        id: z.uuid(),
        target: z.string(),
        value: z.unknown(),
        evidenceLocator: JsonObjectSchema,
        extractionMethod: z.string(),
        confidence: z.number(),
        reviewStatus: z.literal('proposed'),
        observedAt: isoDateTime,
        evidenceId: z.uuid(),
        acquisitionRunId: z.uuid(),
        current: z.boolean(),
        extraction: z
          .object({
            quote: z.string(),
            fieldPath: z.array(z.string()),
            start: z.number().int(),
            end: z.number().int(),
            documentId: z.string(),
            sourceVersion: z.string(),
            explicitness: z.string(),
            ambiguity: z.string(),
            scope: z.string(),
            temporal: z.object({ kind: z.string(), text: z.string().nullable() }),
            ontologyVersion: z.string(),
            evaluationStatus: z.literal('independent_review_pending'),
            grounding: z.literal('technically_validated'),
            conflictingClaimIds: z.array(z.uuid()),
          })
          .nullable(),
      }),
    ),
    evidence: z.array(
      z.object({
        id: z.uuid(),
        sourceRecordKey: z.string(),
        sourceRecordUrl: z.string().nullable(),
        contentSha256: z.string(),
        payload: JsonObjectSchema,
        redactedFields: z.array(z.string()),
        observedAt: isoDateTime,
        datasetVersion: z.string().nullable(),
        artifactSha256: z.string(),
        latest: z.boolean(),
      }),
    ),
    runRecords: z.array(
      z.object({
        acquisitionRunId: z.uuid(),
        evidenceId: z.uuid(),
        position: z.number().int(),
        evidenceOutcome: z.enum(['created', 'unchanged']),
        extractionStatus: z.enum(['parsed', 'rejected']),
        errors: z.array(
          z.object({ code: z.string(), message: z.string(), field: z.string().optional() }),
        ),
        startedAt: isoDateTime,
      }),
    ),
    suggestions: z.array(DuplicateSuggestionSchema),
  })
  .meta({ id: 'CandidateDetail' });
export class CandidateDetailDto extends createZodDto(CandidateDetailSchema) {}

export const AcquisitionReportSchema = z
  .object({
    reportVersion: z.string(),
    generatedAt: isoDateTime,
    campaign: z.object({
      id: z.uuid(),
      name: z.string(),
      county: z.string().nullable(),
      locality: z.string().nullable(),
    }),
    labelling: z.object({ observed: z.string(), estimate: z.string(), notVerified: z.string() }),
    sources: z.array(
      z.object({
        sourceKey: SourceKeySchema,
        label: z.string(),
        reuseTerms: z.string(),
        retentionPolicy: z.string(),
        attribution: z.string(),
        artifacts: z.array(
          z.object({
            sha256: z.string(),
            datasetVersion: z.string().nullable(),
            retrievedAt: isoDateTime,
            byteSize: z.number().int(),
            originalUrl: z.string(),
          }),
        ),
        latestRun: z
          .object({
            id: z.uuid(),
            status: z.string(),
            startedAt: isoDateTime,
            parserVersion: z.string(),
            normalizerVersion: z.string(),
            outputDigest: z.string().nullable(),
          })
          .nullable(),
        runsByStatus: CountsSchema,
        distinctOutputDigests: z.number().int(),
        records: z.object({
          read: z.number().int(),
          parsed: z.number().int(),
          rejected: z.number().int(),
          rejectionsByCode: CountsSchema,
          excludedBySource: CountsSchema,
        }),
        candidates: z.number().int(),
        screening: CountsSchema,
        missingIdentifiers: z.object({ count: z.number().int(), definition: z.string() }),
        derivedKeyCollisions: z.number().int(),
        missingLocation: z.object({
          withoutCounty: z.number().int(),
          withoutSettlement: z.number().int(),
          withoutCoordinates: z.number().int(),
        }),
        fieldCompleteness: z.array(
          z.object({ target: z.string(), candidates: z.number().int(), share: z.number() }),
        ),
      }),
    ),
    crossSource: z.object({
      matcherVersion: z.string(),
      suggestions: z.array(
        z.object({
          relation: z.string(),
          strength: z.string(),
          rule: z.string(),
          sources: z.string(),
          count: z.number().int(),
        }),
      ),
      registerWithOsmCounterpart: z.object({
        likely: z.number().int(),
        likelyOrPossible: z.number().int(),
        total: z.number().int(),
      }),
      osmWithRegisterCounterpart: z.object({
        likely: z.number().int(),
        likelyOrPossible: z.number().int(),
        total: z.number().int(),
      }),
      candidatesWithOnlyPossibleMatches: z.number().int(),
      distinctPropertyEstimate: z.object({
        candidates: z.number().int(),
        likelyClustersOnly: z.number().int(),
        likelyAndPossibleClusters: z.number().int(),
        definition: z.string(),
      }),
      incrementalInScopeCandidates: z.object({
        registerOnly: z.number().int(),
        osmOnly: z.number().int(),
        inBoth: z.number().int(),
        definition: z.string(),
      }),
      registerOperatorGroups: z.object({
        groups: z.number().int(),
        candidates: z.number().int(),
        largest: z.number().int(),
      }),
    }),
    coverage: z.object({
      referencePopulation: z.string(),
      size: z.number().int(),
      reconciledLikely: z.number().int(),
      reconciledLikelyOrPossible: z.number().int(),
      shareLikely: z.number(),
      shareLikelyOrPossible: z.number(),
      byCounty: z.array(
        z.object({
          countyCode: z.string(),
          countyName: z.string(),
          size: z.number().int(),
          reconciledLikely: z.number().int(),
          reconciledLikelyOrPossible: z.number().int(),
        }),
      ),
      caveat: z.string(),
    }),
    entityResolution: z.object({
      status: z.literal('not_measured'),
      reason: z.string(),
      protocol: z.string(),
    }),
    unknowns: z.array(z.string()),
  })
  .meta({ id: 'AcquisitionReport' });
export class AcquisitionReportDto extends createZodDto(AcquisitionReportSchema) {}
