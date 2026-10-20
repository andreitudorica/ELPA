import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';

import { DatabaseService } from '../database';
import type {
  EvidenceLocator,
  JsonObject,
  JsonValue,
  RecordError,
} from './acquisition/source-record';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';
import {
  acquisitionRunRecords,
  acquisitionRuns,
  candidates,
  claims,
  duplicateSuggestions,
  evidence,
  sourceArtifacts,
} from './acquisition.schema';

export interface RunRow {
  id: string;
  sourceKey: string;
  status: string;
  stage: string;
  parserVersion: string;
  normalizerVersion: string;
  startedAt: Date;
  completedAt: Date | null;
  stats: JsonObject;
  outputDigest: string | null;
  failure: { code: string; message: string } | null;
  artifact: {
    id: string;
    sha256: string;
    datasetVersion: string | null;
    originalUrl: string;
    fileName: string;
    byteSize: number;
    retrievedAt: Date;
    reuseTerms: string;
    retentionPolicy: string;
  };
}

export interface CandidateFilters {
  sourceKey?: string;
  screeningClass?: string;
  countyCode?: string;
  search?: string;
  matchStatus?: 'with_suggestions' | 'without_suggestions';
}

export interface CandidateRow {
  id: string;
  sourceKey: string;
  sourceRecordKey: string;
  displayName: string;
  countyCode: string | null;
  settlementName: string | null;
  screeningClass: string;
  verificationStatus: string;
  suggestionCount: number;
  updatedAt: Date;
}

export interface ClaimRow {
  id: string;
  evidenceId: string;
  acquisitionRunId: string;
  target: string;
  value: JsonValue;
  evidenceLocator: EvidenceLocator;
  extractionMethod: string;
  confidence: number;
  reviewStatus: string;
  observedAt: Date;
  current: boolean;
}

export interface EvidenceRow {
  id: string;
  sourceKey: string;
  sourceRecordKey: string;
  sourceRecordUrl: string | null;
  contentSha256: string;
  payload: JsonObject;
  redactedFields: string[];
  observedAt: Date;
  firstSourceArtifactId: string;
  datasetVersion: string | null;
  artifactSha256: string;
}

export interface RunRecordRow {
  acquisitionRunId: string;
  evidenceId: string;
  position: number;
  evidenceOutcome: string;
  extractionStatus: string;
  errors: RecordError[];
  startedAt: Date;
}

export interface SuggestionRow {
  id: string;
  relation: string;
  strength: string;
  score: number;
  signals: JsonObject;
  matcherVersion: string;
  reviewStatus: string;
  left: {
    id: string;
    sourceKey: string;
    displayName: string;
    settlementName: string | null;
    countyCode: string | null;
  };
  right: {
    id: string;
    sourceKey: string;
    displayName: string;
    settlementName: string | null;
    countyCode: string | null;
  };
}

const currentMethods = [...CURRENT_EXTRACTION_METHODS];

@Injectable()
export class AcquisitionQueryRepository {
  constructor(private readonly database: DatabaseService) {}

  async listRuns(researchCampaignId: string): Promise<RunRow[]> {
    const rows = await this.database.executor
      .select({
        id: acquisitionRuns.id,
        sourceKey: acquisitionRuns.sourceKey,
        status: acquisitionRuns.status,
        stage: acquisitionRuns.stage,
        parserVersion: acquisitionRuns.parserVersion,
        normalizerVersion: acquisitionRuns.normalizerVersion,
        startedAt: acquisitionRuns.startedAt,
        completedAt: acquisitionRuns.completedAt,
        stats: acquisitionRuns.stats,
        outputDigest: acquisitionRuns.outputDigest,
        failure: acquisitionRuns.failure,
        artifact: {
          id: sourceArtifacts.id,
          sha256: sourceArtifacts.sha256,
          datasetVersion: sourceArtifacts.datasetVersion,
          originalUrl: sourceArtifacts.originalUrl,
          fileName: sourceArtifacts.fileName,
          byteSize: sourceArtifacts.byteSize,
          retrievedAt: sourceArtifacts.retrievedAt,
          reuseTerms: sourceArtifacts.reuseTerms,
          retentionPolicy: sourceArtifacts.retentionPolicy,
        },
      })
      .from(acquisitionRuns)
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, acquisitionRuns.sourceArtifactId))
      .where(eq(acquisitionRuns.researchCampaignId, researchCampaignId))
      .orderBy(desc(acquisitionRuns.startedAt));
    return rows.map((row) => ({ ...row, failure: row.failure ?? null }));
  }

  private candidateConditions(researchCampaignId: string, filters: CandidateFilters): SQL[] {
    const conditions: SQL[] = [eq(candidates.researchCampaignId, researchCampaignId)];
    if (filters.sourceKey !== undefined)
      conditions.push(eq(candidates.sourceKey, filters.sourceKey));
    if (filters.screeningClass !== undefined) {
      conditions.push(eq(candidates.screeningClass, filters.screeningClass));
    }
    if (filters.countyCode !== undefined)
      conditions.push(eq(candidates.countyCode, filters.countyCode));
    if (filters.search !== undefined) {
      const pattern = `%${filters.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      const searchCondition = or(
        ilike(candidates.displayName, pattern),
        ilike(candidates.settlementName, pattern),
        ilike(candidates.sourceRecordKey, pattern),
      );
      if (searchCondition !== undefined) conditions.push(searchCondition);
    }
    const hasSuggestion = sql`exists (
      select 1 from ${duplicateSuggestions}
      where ${duplicateSuggestions.leftCandidateId} = ${candidates.id}
         or ${duplicateSuggestions.rightCandidateId} = ${candidates.id})`;
    if (filters.matchStatus === 'with_suggestions') conditions.push(hasSuggestion);
    if (filters.matchStatus === 'without_suggestions') conditions.push(sql`not ${hasSuggestion}`);
    return conditions;
  }

  async listCandidates(
    researchCampaignId: string,
    filters: CandidateFilters,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: CandidateRow[] }> {
    const where = and(...this.candidateConditions(researchCampaignId, filters));
    const [count] = await this.database.executor
      .select({ total: sql<number>`count(*)::int` })
      .from(candidates)
      .where(where);
    const items = await this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        displayName: candidates.displayName,
        countyCode: candidates.countyCode,
        settlementName: candidates.settlementName,
        screeningClass: candidates.screeningClass,
        verificationStatus: candidates.verificationStatus,
        suggestionCount: sql<number>`(
          select count(*)::int from ${duplicateSuggestions}
          where ${duplicateSuggestions.leftCandidateId} = ${candidates.id}
             or ${duplicateSuggestions.rightCandidateId} = ${candidates.id})`,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .where(where)
      .orderBy(asc(candidates.displayName), asc(candidates.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { total: count?.total ?? 0, items };
  }

  async findCandidate(researchCampaignId: string, candidateId: string) {
    const [candidate] = await this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        kind: candidates.kind,
        displayName: candidates.displayName,
        countyCode: candidates.countyCode,
        settlementName: candidates.settlementName,
        screeningClass: candidates.screeningClass,
        verificationStatus: candidates.verificationStatus,
        latestEvidenceId: candidates.latestEvidenceId,
        firstSeenRunId: candidates.firstSeenRunId,
        lastSeenRunId: candidates.lastSeenRunId,
        createdAt: candidates.createdAt,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .where(
        and(eq(candidates.id, candidateId), eq(candidates.researchCampaignId, researchCampaignId)),
      );
    return candidate;
  }

  async listCandidateClaims(candidateId: string, latestEvidenceId: string): Promise<ClaimRow[]> {
    const rows = await this.database.executor
      .select({
        id: claims.id,
        evidenceId: claims.evidenceId,
        acquisitionRunId: claims.acquisitionRunId,
        target: claims.target,
        value: claims.value,
        evidenceLocator: claims.evidenceLocator,
        extractionMethod: claims.extractionMethod,
        confidence: claims.confidence,
        reviewStatus: claims.reviewStatus,
        observedAt: claims.observedAt,
      })
      .from(claims)
      .where(eq(claims.candidateId, candidateId))
      .orderBy(asc(claims.target), desc(claims.createdAt));
    return rows.map((row) => ({
      ...row,
      current:
        row.evidenceId === latestEvidenceId &&
        (currentMethods as readonly string[]).includes(row.extractionMethod),
    }));
  }

  async listCandidateEvidence(candidateId: string): Promise<EvidenceRow[]> {
    return this.database.executor
      .selectDistinct({
        id: evidence.id,
        sourceKey: evidence.sourceKey,
        sourceRecordKey: evidence.sourceRecordKey,
        sourceRecordUrl: evidence.sourceRecordUrl,
        contentSha256: evidence.contentSha256,
        payload: evidence.payload,
        redactedFields: evidence.redactedFields,
        observedAt: evidence.observedAt,
        firstSourceArtifactId: evidence.firstSourceArtifactId,
        datasetVersion: sourceArtifacts.datasetVersion,
        artifactSha256: sourceArtifacts.sha256,
      })
      .from(evidence)
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, evidence.firstSourceArtifactId))
      .innerJoin(acquisitionRunRecords, eq(acquisitionRunRecords.evidenceId, evidence.id))
      .where(eq(acquisitionRunRecords.candidateId, candidateId))
      .orderBy(desc(evidence.observedAt));
  }

  async listCandidateRunRecords(candidateId: string): Promise<RunRecordRow[]> {
    return this.database.executor
      .select({
        acquisitionRunId: acquisitionRunRecords.acquisitionRunId,
        evidenceId: acquisitionRunRecords.evidenceId,
        position: acquisitionRunRecords.position,
        evidenceOutcome: acquisitionRunRecords.evidenceOutcome,
        extractionStatus: acquisitionRunRecords.extractionStatus,
        errors: acquisitionRunRecords.errors,
        startedAt: acquisitionRuns.startedAt,
      })
      .from(acquisitionRunRecords)
      .innerJoin(acquisitionRuns, eq(acquisitionRuns.id, acquisitionRunRecords.acquisitionRunId))
      .where(eq(acquisitionRunRecords.candidateId, candidateId))
      .orderBy(desc(acquisitionRuns.startedAt));
  }

  async listSuggestions(
    researchCampaignId: string,
    filters: { relation?: string; strength?: string; candidateId?: string; matcherVersion: string },
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: SuggestionRow[] }> {
    const conditions: SQL[] = [
      eq(duplicateSuggestions.researchCampaignId, researchCampaignId),
      eq(duplicateSuggestions.matcherVersion, filters.matcherVersion),
    ];
    if (filters.relation !== undefined)
      conditions.push(eq(duplicateSuggestions.relation, filters.relation));
    if (filters.strength !== undefined)
      conditions.push(eq(duplicateSuggestions.strength, filters.strength));
    if (filters.candidateId !== undefined) {
      const condition = or(
        eq(duplicateSuggestions.leftCandidateId, filters.candidateId),
        eq(duplicateSuggestions.rightCandidateId, filters.candidateId),
      );
      if (condition !== undefined) conditions.push(condition);
    }
    const where = and(...conditions);
    const [count] = await this.database.executor
      .select({ total: sql<number>`count(*)::int` })
      .from(duplicateSuggestions)
      .where(where);

    const rows = await this.database.executor
      .select({
        id: duplicateSuggestions.id,
        relation: duplicateSuggestions.relation,
        strength: duplicateSuggestions.strength,
        score: duplicateSuggestions.score,
        signals: duplicateSuggestions.signals,
        matcherVersion: duplicateSuggestions.matcherVersion,
        reviewStatus: duplicateSuggestions.reviewStatus,
        leftId: duplicateSuggestions.leftCandidateId,
        rightId: duplicateSuggestions.rightCandidateId,
      })
      .from(duplicateSuggestions)
      .where(where)
      .orderBy(
        asc(duplicateSuggestions.strength),
        desc(duplicateSuggestions.score),
        asc(duplicateSuggestions.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const ids = [...new Set(rows.flatMap((row) => [row.leftId, row.rightId]))];
    const summaries =
      ids.length === 0
        ? []
        : await this.database.executor
            .select({
              id: candidates.id,
              sourceKey: candidates.sourceKey,
              displayName: candidates.displayName,
              settlementName: candidates.settlementName,
              countyCode: candidates.countyCode,
            })
            .from(candidates)
            .where(inArray(candidates.id, ids));
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));
    const items = rows.flatMap(({ leftId, rightId, ...row }) => {
      const left = byId.get(leftId);
      const right = byId.get(rightId);
      return left === undefined || right === undefined ? [] : [{ ...row, left, right }];
    });
    return { total: count?.total ?? 0, items };
  }

  // ---- Report aggregates -------------------------------------------------

  async candidateCounts(researchCampaignId: string) {
    return this.database.executor
      .select({
        sourceKey: candidates.sourceKey,
        screeningClass: candidates.screeningClass,
        withCounty: sql<number>`count(${candidates.countyCode})::int`,
        withSettlement: sql<number>`count(${candidates.settlementName})::int`,
        derivedKeyCollisions: sql<number>`count(*) filter (where ${candidates.sourceRecordKey} like '%#%')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(candidates)
      .where(eq(candidates.researchCampaignId, researchCampaignId))
      .groupBy(candidates.sourceKey, candidates.screeningClass);
  }

  /** Candidates with a current Claim for each target, per source. */
  async claimTargetCoverage(researchCampaignId: string) {
    return this.database.executor
      .select({
        sourceKey: candidates.sourceKey,
        target: claims.target,
        candidates: sql<number>`count(distinct ${candidates.id})::int`,
      })
      .from(candidates)
      .innerJoin(
        claims,
        and(
          eq(claims.candidateId, candidates.id),
          eq(claims.evidenceId, candidates.latestEvidenceId),
        ),
      )
      .where(
        and(
          eq(candidates.researchCampaignId, researchCampaignId),
          inArray(claims.extractionMethod, currentMethods),
        ),
      )
      .groupBy(candidates.sourceKey, claims.target);
  }

  async candidatesForClustering(researchCampaignId: string) {
    return this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        screeningClass: candidates.screeningClass,
        countyCode: candidates.countyCode,
      })
      .from(candidates)
      .where(eq(candidates.researchCampaignId, researchCampaignId));
  }

  async suggestionEdges(researchCampaignId: string, matcherVersion: string) {
    return this.database.executor
      .select({
        id: duplicateSuggestions.id,
        left: duplicateSuggestions.leftCandidateId,
        right: duplicateSuggestions.rightCandidateId,
        relation: duplicateSuggestions.relation,
        strength: duplicateSuggestions.strength,
        rule: sql<string>`${duplicateSuggestions.signals}->'decisionRules'->>0`,
      })
      .from(duplicateSuggestions)
      .where(
        and(
          eq(duplicateSuggestions.researchCampaignId, researchCampaignId),
          eq(duplicateSuggestions.matcherVersion, matcherVersion),
        ),
      );
  }

  /** Register operators (by tax id) holding more than one certificate. */
  async registerOperatorGroups(researchCampaignId: string) {
    const result = await this.database.executor.execute<{
      groups: number;
      candidates: number;
      largest: number;
    }>(sql`
      select count(*)::int as groups, coalesce(sum(size), 0)::int as candidates, coalesce(max(size), 0)::int as largest
      from (
        select ${claims.value} #>> '{}' as tax_id, count(distinct ${candidates.id}) as size
        from ${candidates}
        join ${claims} on ${claims.candidateId} = ${candidates.id} and ${claims.evidenceId} = ${candidates.latestEvidenceId}
        where ${candidates.researchCampaignId} = ${researchCampaignId}
          and ${candidates.sourceKey} = 'situr_accommodation_register'
          and ${claims.target} = 'provider_hint.tax_id'
          and ${claims.extractionMethod} in (${sql.join(
            currentMethods.map((method) => sql`${method}`),
            sql`, `,
          )})
        group by 1
        having count(distinct ${candidates.id}) > 1
      ) operator_groups`);
    return result.rows[0] ?? { groups: 0, candidates: 0, largest: 0 };
  }

  async runRecordTotals(runId: string) {
    return this.database.executor
      .select({
        extractionStatus: acquisitionRunRecords.extractionStatus,
        evidenceOutcome: acquisitionRunRecords.evidenceOutcome,
        inCampaignScope: acquisitionRunRecords.inCampaignScope,
        total: sql<number>`count(*)::int`,
      })
      .from(acquisitionRunRecords)
      .where(eq(acquisitionRunRecords.acquisitionRunId, runId))
      .groupBy(
        acquisitionRunRecords.extractionStatus,
        acquisitionRunRecords.evidenceOutcome,
        acquisitionRunRecords.inCampaignScope,
      );
  }
}
