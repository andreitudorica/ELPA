import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { DatabaseService, uuidV7 } from '../database';
import { candidates, claims, evidence, sourceArtifacts } from './acquisition.schema';
import {
  ATTRIBUTES,
  type ReconciliationCase,
  type ReconciliationResult,
} from './reconciliation/contracts';
import { reconciliationAssessments } from './reconciliation.schema';

@Injectable()
export class ReconciliationRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Lightweight frame; primary records are loaded only after the sealed draw. */
  async frame(campaignId: string) {
    return this.database.executor
      .select({
        candidateId: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
        countyCode: candidates.countyCode,
        claimId: claims.id,
        evidenceId: claims.evidenceId,
        target: claims.target,
        method: claims.extractionMethod,
        evidenceSha256: evidence.contentSha256,
        description: sql<
          string | null
        >`coalesce(${evidence.payload}->'tags'->>'description', ${evidence.payload}->'tags'->>'description:ro', ${evidence.payload}->'tags'->>'description:en')`,
      })
      .from(candidates)
      .innerJoin(claims, eq(claims.candidateId, candidates.id))
      .innerJoin(evidence, eq(evidence.id, claims.evidenceId))
      .where(
        and(
          eq(candidates.researchCampaignId, campaignId),
          inArray(
            claims.target,
            ATTRIBUTES.map((a) => `offer.${a}`),
          ),
        ),
      )
      .orderBy(asc(claims.id));
  }

  async loadClaims(campaignId: string, candidateIds: string[]) {
    if (candidateIds.length === 0) return [];
    return this.database.executor
      .select({
        id: claims.id,
        candidateId: claims.candidateId,
        evidenceId: claims.evidenceId,
        target: claims.target,
        value: claims.value,
        evidenceLocator: claims.evidenceLocator,
        extractionMethod: claims.extractionMethod,
        observedAt: claims.observedAt,
        createdAt: claims.createdAt,
        latestEvidenceId: candidates.latestEvidenceId,
        candidateSourceKey: candidates.sourceKey,
        candidateSourceRecordKey: candidates.sourceRecordKey,
        evidence: {
          id: evidence.id,
          sourceKey: evidence.sourceKey,
          sourceRecordKey: evidence.sourceRecordKey,
          sourceRecordUrl: evidence.sourceRecordUrl,
          payload: evidence.payload,
          contentSha256: evidence.contentSha256,
          observedAt: evidence.observedAt,
          createdAt: evidence.createdAt,
          artifactId: sourceArtifacts.id,
          artifactSha256: sourceArtifacts.sha256,
          sourceVersion: sourceArtifacts.datasetVersion,
          retrievedAt: sourceArtifacts.retrievedAt,
          reuseTerms: sourceArtifacts.reuseTerms,
          retentionPolicy: sourceArtifacts.retentionPolicy,
        },
      })
      .from(claims)
      .innerJoin(candidates, eq(candidates.id, claims.candidateId))
      .innerJoin(evidence, eq(evidence.id, claims.evidenceId))
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, evidence.firstSourceArtifactId))
      .where(
        and(
          eq(candidates.researchCampaignId, campaignId),
          inArray(candidates.id, candidateIds),
          inArray(claims.target, [
            ...ATTRIBUTES.map((a) => `offer.${a}`),
            ...ATTRIBUTES.map((a) => `image.visible.${a}`),
          ]),
        ),
      )
      .orderBy(asc(claims.id));
  }

  async store(
    campaignId: string,
    input: ReconciliationCase,
    result: ReconciliationResult,
    administratorId: string,
  ) {
    const id = uuidV7(),
      now = new Date();
    const inserted = await this.database.executor
      .insert(reconciliationAssessments)
      .values({
        id,
        researchCampaignId: campaignId,
        candidateId: input.anchorCandidateId,
        ruleVersion: result.ruleVersion,
        inputDigest: result.inputDigest,
        asOf: new Date(result.asOf),
        assessedAt: now,
        input,
        result,
        initiatedByAdministratorId: administratorId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: reconciliationAssessments.id });
    return inserted[0]?.id ?? null;
  }

  async list(campaignId: string, candidateId: string) {
    return this.database.executor
      .select({
        id: reconciliationAssessments.id,
        assessedAt: reconciliationAssessments.assessedAt,
        input: reconciliationAssessments.input,
        result: reconciliationAssessments.result,
      })
      .from(reconciliationAssessments)
      .where(
        and(
          eq(reconciliationAssessments.researchCampaignId, campaignId),
          // Every participating Candidate can inspect the same retained assessment.
          sql`${reconciliationAssessments.input}->'candidateIds' @> ${JSON.stringify([candidateId])}::jsonb`,
        ),
      )
      .orderBy(desc(reconciliationAssessments.assessedAt))
      .limit(20);
  }
}
