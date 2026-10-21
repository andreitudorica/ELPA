import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DatabaseService } from '../database';
import { acquisitionRunRecords, candidates, claims, evidence } from './acquisition.schema';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';

@Injectable()
export class VisualRepository {
  constructor(private readonly database: DatabaseService) {}

  async referenceCounts(campaignId: string) {
    const [row] = await this.database.executor
      .select({
        imageTags: sql<number>`count(*) filter (where ${evidence.payload}->'tags' ? 'image')::int`,
        commonsImageUrls: sql<number>`count(*) filter (where ${evidence.payload}->'tags'->>'image' like 'https://upload.wikimedia.org/%')::int`,
      })
      .from(candidates)
      .innerJoin(evidence, eq(evidence.id, candidates.latestEvidenceId))
      .where(
        and(
          eq(candidates.researchCampaignId, campaignId),
          eq(candidates.sourceKey, 'osm_geofabrik_romania'),
        ),
      );
    return row ?? { imageTags: 0, commonsImageUrls: 0 };
  }

  async frame(campaignId: string) {
    return this.database.executor
      .select({
        candidateId: candidates.id,
        sourceRecordKey: candidates.sourceRecordKey,
        countyCode: candidates.countyCode,
        sourceEvidenceId: evidence.id,
        sourceEvidenceSha256: evidence.contentSha256,
        payload: evidence.payload,
      })
      .from(candidates)
      .innerJoin(evidence, eq(evidence.id, candidates.latestEvidenceId))
      .where(
        and(
          eq(candidates.researchCampaignId, campaignId),
          eq(candidates.sourceKey, 'osm_geofabrik_romania'),
          sql`${evidence.payload}->'tags' ? 'wikimedia_commons'`,
        ),
      )
      .orderBy(candidates.sourceRecordKey);
  }

  async members(campaignId: string) {
    return this.database.executor
      .select({
        id: candidates.id,
        sourceKey: candidates.sourceKey,
        sourceRecordKey: candidates.sourceRecordKey,
      })
      .from(candidates)
      .where(eq(candidates.researchCampaignId, campaignId));
  }

  async linked(campaignId: string, candidateId: string, evidenceId: string) {
    const [row] = await this.database.executor
      .select({
        payload: evidence.payload,
        contentSha256: evidence.contentSha256,
        artifactId: evidence.firstSourceArtifactId,
      })
      .from(candidates)
      .innerJoin(acquisitionRunRecords, eq(acquisitionRunRecords.candidateId, candidates.id))
      .innerJoin(evidence, eq(evidence.id, acquisitionRunRecords.evidenceId))
      .where(
        and(
          eq(candidates.id, candidateId),
          eq(candidates.researchCampaignId, campaignId),
          eq(evidence.id, evidenceId),
        ),
      )
      .limit(1);
    return row;
  }

  async textClaims(ids: string[]) {
    if (ids.length === 0) return [];
    return this.database.executor
      .select({
        candidateId: claims.candidateId,
        target: claims.target,
        value: claims.value,
        method: claims.extractionMethod,
      })
      .from(claims)
      .innerJoin(
        candidates,
        and(
          eq(candidates.id, claims.candidateId),
          eq(candidates.latestEvidenceId, claims.evidenceId),
        ),
      )
      .where(
        and(
          inArray(claims.candidateId, ids),
          inArray(claims.extractionMethod, [...CURRENT_EXTRACTION_METHODS]),
        ),
      );
  }
}
