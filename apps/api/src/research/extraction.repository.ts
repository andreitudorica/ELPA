import { Injectable } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';

import { DatabaseService } from '../database';
import { candidates, claims, evidence, sourceArtifacts } from './acquisition.schema';
import { documentFromEvidence } from './extraction/documents';
import { DETERMINISTIC_VERSION } from './extraction/deterministic';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';

@Injectable()
export class ExtractionRepository {
  constructor(private readonly database: DatabaseService) {}

  async loadPriorClaims(candidateIds: string[]) {
    if (candidateIds.length === 0) return [];
    return this.database.executor
      .select({
        candidateId: claims.candidateId,
        evidenceId: claims.evidenceId,
        target: claims.target,
        value: claims.value,
      })
      .from(claims)
      .where(
        and(
          inArray(claims.candidateId, candidateIds),
          inArray(claims.extractionMethod, [...CURRENT_EXTRACTION_METHODS]),
          ne(claims.extractionMethod, DETERMINISTIC_VERSION),
        ),
      );
  }

  async loadDocuments(campaignId: string, evidenceIds?: string[]) {
    if (evidenceIds?.length === 0) return [];
    const rows = await this.database.executor
      .select({
        candidateId: candidates.id,
        countyCode: candidates.countyCode,
        evidenceId: evidence.id,
        sourceKey: evidence.sourceKey,
        sourceRecordKey: evidence.sourceRecordKey,
        payload: evidence.payload,
        contentSha256: evidence.contentSha256,
        observedAt: evidence.observedAt,
        artifactId: sourceArtifacts.id,
        sourceVersion: sourceArtifacts.datasetVersion,
        artifactSha256: sourceArtifacts.sha256,
      })
      .from(candidates)
      .innerJoin(
        evidence,
        evidenceIds === undefined
          ? eq(evidence.id, candidates.latestEvidenceId)
          : and(
              eq(evidence.sourceKey, candidates.sourceKey),
              eq(evidence.sourceRecordKey, candidates.sourceRecordKey),
              inArray(evidence.id, evidenceIds),
            ),
      )
      .innerJoin(sourceArtifacts, eq(sourceArtifacts.id, evidence.firstSourceArtifactId))
      .where(eq(candidates.researchCampaignId, campaignId));
    return rows.map((row) => ({ document: documentFromEvidence(row), countyCode: row.countyCode }));
  }
}
