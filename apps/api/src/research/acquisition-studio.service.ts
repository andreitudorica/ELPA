import { Injectable } from '@nestjs/common';

import { NotFoundError } from '../common';
import type { EvidenceSourceKey, ScreeningClass, SourceKey } from './acquisition/source-record';
import {
  AcquisitionQueryRepository,
  type CandidateRow,
  type SuggestionRow,
} from './acquisition-query.repository';
import type {
  AcquisitionRunListDto,
  CandidateDetailDto,
  CandidatePageDto,
  CandidateQueryDto,
  DuplicateSuggestionPageDto,
  SuggestionQueryDto,
} from './dto/acquisition.dto';
import { MATCHER_VERSION } from './matching/duplicate-matcher';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { canonicalJson } from './acquisition/source-record';
import { imageAnnotationLocatorSchema, imageSchema } from './visual/contracts';

/** Read models that make the acquisition experiment inspectable in Data Studio. */
@Injectable()
export class AcquisitionStudioService {
  constructor(
    private readonly campaigns: ResearchCampaignRepository,
    private readonly queries: AcquisitionQueryRepository,
  ) {}

  private async requireCampaign(campaignId: string): Promise<void> {
    if ((await this.campaigns.findById(campaignId)) === undefined) {
      throw new NotFoundError(`Research Campaign ${campaignId} does not exist`);
    }
  }

  async listRuns(campaignId: string): Promise<AcquisitionRunListDto> {
    await this.requireCampaign(campaignId);
    const runs = await this.queries.listRuns(campaignId);
    return runs.map((run) => ({
      id: run.id,
      sourceKey: run.sourceKey as EvidenceSourceKey,
      stage: run.stage === 'extract' ? 'extract' : 'import',
      status: run.status as AcquisitionRunListDto[number]['status'],
      parserVersion: run.parserVersion,
      normalizerVersion: run.normalizerVersion,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      outputDigest: run.outputDigest,
      failure: run.failure,
      stats: run.stats,
      artifact: { ...run.artifact, retrievedAt: run.artifact.retrievedAt.toISOString() },
    }));
  }

  async listCandidates(campaignId: string, query: CandidateQueryDto): Promise<CandidatePageDto> {
    await this.requireCampaign(campaignId);
    const result = await this.queries.listCandidates(
      campaignId,
      {
        sourceKey: query.source,
        screeningClass: query.screening,
        countyCode: query.county,
        search: query.search,
        matchStatus: query.match,
      },
      query.page,
      query.pageSize,
    );
    return {
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
      items: result.items.map(toCandidateSummary),
    };
  }

  async getCandidate(campaignId: string, candidateId: string): Promise<CandidateDetailDto> {
    const candidate = await this.queries.findCandidate(campaignId, candidateId);
    if (candidate === undefined) {
      throw new NotFoundError(`Candidate ${candidateId} does not exist in campaign ${campaignId}`);
    }
    const [claimRows, evidenceRows, runRecords, suggestions] = await Promise.all([
      this.queries.listCandidateClaims(candidate.id, candidate.latestEvidenceId),
      this.queries.listCandidateEvidence(candidate.id),
      this.queries.listCandidateRunRecords(candidate.id),
      this.queries.listSuggestions(
        campaignId,
        { candidateId: candidate.id, matcherVersion: MATCHER_VERSION },
        1,
        100,
      ),
    ]);
    const latest = evidenceRows.find((row) => row.id === candidate.latestEvidenceId);

    return {
      candidate: {
        ...toCandidateSummary({ ...candidate, suggestionCount: suggestions.total }),
        kind: 'offer',
        sourceRecordUrl: latest?.sourceRecordUrl ?? null,
        latestEvidenceId: candidate.latestEvidenceId,
        firstSeenRunId: candidate.firstSeenRunId,
        lastSeenRunId: candidate.lastSeenRunId,
        createdAt: candidate.createdAt.toISOString(),
      },
      claims: claimRows.map((claim) => ({
        id: claim.id,
        target: claim.target,
        value: claim.value,
        evidenceLocator: claim.evidenceLocator,
        extractionMethod: claim.extractionMethod,
        confidence: claim.confidence,
        reviewStatus: 'proposed',
        observedAt: claim.observedAt.toISOString(),
        evidenceId: claim.evidenceId,
        acquisitionRunId: claim.acquisitionRunId,
        current: claim.current,
        visual: imageAnnotationLocatorSchema.safeParse(claim.evidenceLocator).data ?? null,
        extraction:
          claim.evidenceLocator.type === 'text_span'
            ? {
                ...claim.evidenceLocator,
                conflictingClaimIds: claimRows
                  .filter(
                    (other) =>
                      other.id !== claim.id &&
                      other.current &&
                      other.target === claim.target &&
                      !['offer.recreation', 'offer.outdoor_covered_area'].includes(claim.target) &&
                      canonicalJson(other.value) !== canonicalJson(claim.value),
                  )
                  .map((other) => other.id),
              }
            : null,
      })),
      evidence: evidenceRows.map((row) => ({
        id: row.id,
        sourceRecordKey: row.sourceRecordKey,
        sourceRecordUrl: row.sourceRecordUrl,
        contentSha256: row.contentSha256,
        payload: row.payload,
        image: imageSchema.safeParse(row.payload).data ?? null,
        redactedFields: row.redactedFields,
        observedAt: row.observedAt.toISOString(),
        datasetVersion: row.datasetVersion,
        artifactSha256: row.artifactSha256,
        latest: row.id === candidate.latestEvidenceId,
      })),
      runRecords: runRecords.map((record) => ({
        acquisitionRunId: record.acquisitionRunId,
        evidenceId: record.evidenceId,
        position: record.position,
        evidenceOutcome: record.evidenceOutcome as 'created' | 'unchanged',
        extractionStatus: record.extractionStatus as 'parsed' | 'rejected',
        errors: record.errors,
        startedAt: record.startedAt.toISOString(),
      })),
      suggestions: suggestions.items.map(toSuggestion),
    };
  }

  async listSuggestions(
    campaignId: string,
    query: SuggestionQueryDto,
  ): Promise<DuplicateSuggestionPageDto> {
    await this.requireCampaign(campaignId);
    const result = await this.queries.listSuggestions(
      campaignId,
      { relation: query.relation, strength: query.strength, matcherVersion: MATCHER_VERSION },
      query.page,
      query.pageSize,
    );
    return {
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
      matcherVersion: MATCHER_VERSION,
      items: result.items.map(toSuggestion),
    };
  }
}

function toCandidateSummary(
  row: Omit<CandidateRow, 'suggestionCount'> & { suggestionCount: number },
): CandidatePageDto['items'][number] {
  return {
    id: row.id,
    sourceKey: row.sourceKey as SourceKey,
    sourceRecordKey: row.sourceRecordKey,
    displayName: row.displayName,
    countyCode: row.countyCode,
    settlementName: row.settlementName,
    screeningClass: row.screeningClass as ScreeningClass,
    verificationStatus: 'unverified',
    suggestionCount: row.suggestionCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSuggestion(row: SuggestionRow): DuplicateSuggestionPageDto['items'][number] {
  const reference = (side: SuggestionRow['left']) => ({
    ...side,
    sourceKey: side.sourceKey as SourceKey,
  });
  return {
    id: row.id,
    relation: row.relation as 'same_property' | 'same_provider',
    strength: row.strength as 'likely' | 'possible',
    score: row.score,
    matcherVersion: row.matcherVersion,
    reviewStatus: 'unreviewed',
    signals: row.signals,
    left: reference(row.left),
    right: reference(row.right),
  };
}
