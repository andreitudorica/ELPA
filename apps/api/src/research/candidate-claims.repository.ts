import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DatabaseService, uuidV7 } from '../database';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';
import type { JsonValue, SourceKey } from './acquisition/source-record';
import { candidates, claims, duplicateSuggestions } from './acquisition.schema';
import type { DuplicateSuggestionDraft } from './matching/duplicate-matcher';

export interface CandidateClaimSet {
  id: string;
  sourceKey: SourceKey;
  sourceRecordKey: string;
  countyCode: string | null;
  claims: Record<string, JsonValue>;
}

/** Read and write access used by duplicate detection and reporting. */
@Injectable()
export class CandidateClaimsRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Each Candidate with the current Claims of its latest Evidence for the
   * requested targets (see CURRENT_EXTRACTION_METHODS).
   */
  async loadLatestClaims(
    researchCampaignId: string,
    targets: readonly string[],
  ): Promise<CandidateClaimSet[]> {
    const rows = await this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        countyCode: candidates.countyCode,
        target: claims.target,
        value: claims.value,
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
          inArray(claims.target, [...targets]),
          inArray(claims.extractionMethod, [...CURRENT_EXTRACTION_METHODS]),
        ),
      );

    const byCandidate = new Map<string, CandidateClaimSet>();
    for (const row of rows) {
      const entry = byCandidate.get(row.id) ?? {
        id: row.id,
        sourceKey: row.sourceKey as SourceKey,
        sourceRecordKey: row.sourceRecordKey,
        countyCode: row.countyCode,
        claims: {},
      };
      entry.claims[row.target] = row.value;
      byCandidate.set(row.id, entry);
    }
    return [...byCandidate.values()];
  }

  async storeSuggestions(
    researchCampaignId: string,
    matcherVersion: string,
    drafts: DuplicateSuggestionDraft[],
  ): Promise<number> {
    let created = 0;
    for (let start = 0; start < drafts.length; start += 1000) {
      const now = new Date();
      const rows = await this.database.executor
        .insert(duplicateSuggestions)
        .values(
          drafts.slice(start, start + 1000).map((draft) => ({
            id: uuidV7(),
            researchCampaignId,
            ...draft,
            matcherVersion,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing({
          target: [
            duplicateSuggestions.leftCandidateId,
            duplicateSuggestions.rightCandidateId,
            duplicateSuggestions.relation,
            duplicateSuggestions.matcherVersion,
          ],
        })
        .returning({ id: duplicateSuggestions.id });
      created += rows.length;
    }
    return created;
  }

  async countSuggestions(researchCampaignId: string, matcherVersion: string): Promise<number> {
    const [row] = await this.database.executor
      .select({ count: sql<number>`count(*)::int` })
      .from(duplicateSuggestions)
      .where(
        and(
          eq(duplicateSuggestions.researchCampaignId, researchCampaignId),
          eq(duplicateSuggestions.matcherVersion, matcherVersion),
        ),
      );
    return row?.count ?? 0;
  }
}
