import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DatabaseService, uuidV7 } from '../database';
import type {
  EvidenceLocator,
  JsonObject,
  JsonValue,
  RecordError,
  ScreeningClass,
  SourceKey,
} from './acquisition/source-record';
import {
  acquisitionRunRecords,
  acquisitionRuns,
  candidates,
  claims,
  evidence,
  sourceArtifacts,
} from './acquisition.schema';

/** Keeps every statement well below PostgreSQL's 65,535 bind-parameter limit. */
const BATCH_SIZE = 1000;

export type AcquisitionRunStatus = 'running' | 'succeeded' | 'completed_with_rejections' | 'failed';

export interface RegisterArtifactInput {
  sourceKey: SourceKey;
  originalUrl: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  retrievedAt: Date;
  reuseTerms: 'odbl_1_0' | 'ro_public_register_no_explicit_licence';
  retentionPolicy: 'full_record' | 'personal_data_redacted';
}

export interface ArtifactRecord {
  id: string;
  datasetVersion: string | null;
  sha256: string;
}

export interface NewEvidence {
  sourceRecordKey: string;
  sourceRecordUrl: string | null;
  contentSha256: string;
  payload: JsonObject;
  redactedFields: string[];
}

export interface NewRunRecord {
  evidenceId: string;
  position: number;
  evidenceOutcome: 'created' | 'unchanged';
  extractionStatus: 'parsed' | 'rejected';
  errors: RecordError[];
  inCampaignScope: boolean;
  candidateId: string | null;
}

export interface CandidateUpsert {
  sourceRecordKey: string;
  latestEvidenceId: string;
  displayName: string;
  countyCode: string | null;
  settlementName: string | null;
  screeningClass: ScreeningClass;
}

export interface NewClaim {
  candidateId: string;
  evidenceId: string;
  target: string;
  value: JsonValue;
  evidenceLocator: EvidenceLocator;
  extractionMethod: string;
  confidence: number;
}

function* batches<T>(items: T[]): Generator<T[]> {
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    yield items.slice(start, start + BATCH_SIZE);
  }
}

@Injectable()
export class AcquisitionRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Returns the existing artifact with the same checksum, or registers a new one. */
  async registerArtifact(input: RegisterArtifactInput): Promise<ArtifactRecord> {
    const now = new Date();
    await this.database.executor
      .insert(sourceArtifacts)
      .values({ id: uuidV7(), ...input, metadata: {}, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: [sourceArtifacts.sourceKey, sourceArtifacts.sha256] });

    const [artifact] = await this.database.executor
      .select({
        id: sourceArtifacts.id,
        datasetVersion: sourceArtifacts.datasetVersion,
        sha256: sourceArtifacts.sha256,
      })
      .from(sourceArtifacts)
      .where(
        and(
          eq(sourceArtifacts.sourceKey, input.sourceKey),
          eq(sourceArtifacts.sha256, input.sha256),
        ),
      );
    if (artifact === undefined) throw new Error('Source artifact registration failed');
    return artifact;
  }

  /** Records the version stated inside the artifact; it never changes once known. */
  async recordArtifactVersion(
    artifactId: string,
    datasetVersion: string,
    metadata: JsonObject,
  ): Promise<void> {
    await this.database.executor
      .update(sourceArtifacts)
      .set({ datasetVersion, metadata, updatedAt: new Date() })
      .where(
        and(eq(sourceArtifacts.id, artifactId), sql`${sourceArtifacts.datasetVersion} is null`),
      );
  }

  async createRun(input: {
    id: string;
    researchCampaignId: string;
    sourceKey: SourceKey;
    sourceArtifactId: string;
    parserVersion: string;
    normalizerVersion: string;
    administratorId: string;
    startedAt: Date;
  }): Promise<void> {
    await this.database.executor.insert(acquisitionRuns).values({
      id: input.id,
      researchCampaignId: input.researchCampaignId,
      sourceKey: input.sourceKey,
      sourceArtifactId: input.sourceArtifactId,
      stage: 'import',
      parserVersion: input.parserVersion,
      normalizerVersion: input.normalizerVersion,
      status: 'running',
      startedAt: input.startedAt,
      initiatedByAdministratorId: input.administratorId,
      createdAt: input.startedAt,
      updatedAt: input.startedAt,
    });
  }

  async finishRun(
    runId: string,
    outcome: {
      status: Exclude<AcquisitionRunStatus, 'running'>;
      stats: JsonObject;
      outputDigest: string | null;
      failure: { code: string; message: string } | null;
    },
  ): Promise<void> {
    const now = new Date();
    await this.database.executor
      .update(acquisitionRuns)
      .set({ ...outcome, completedAt: now, updatedAt: now })
      .where(and(eq(acquisitionRuns.id, runId), eq(acquisitionRuns.status, 'running')));
  }

  /**
   * Inserts Evidence that is not yet stored and returns the id of every
   * record, flagged as created or unchanged.
   */
  async storeEvidence(
    sourceKey: SourceKey,
    artifactId: string,
    observedAt: Date,
    records: NewEvidence[],
  ): Promise<Map<string, { id: string; created: boolean }>> {
    const result = new Map<string, { id: string; created: boolean }>();
    for (const batch of batches(records)) {
      const now = new Date();
      const created = await this.database.executor
        .insert(evidence)
        .values(
          batch.map((record) => ({
            id: uuidV7(),
            sourceKey,
            ...record,
            firstSourceArtifactId: artifactId,
            observedAt,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing({
          target: [evidence.sourceKey, evidence.sourceRecordKey, evidence.contentSha256],
        })
        .returning({ id: evidence.id, sourceRecordKey: evidence.sourceRecordKey });
      for (const row of created) result.set(row.sourceRecordKey, { id: row.id, created: true });

      const missing = batch.filter((record) => !result.has(record.sourceRecordKey));
      if (missing.length === 0) continue;
      const existing = await this.database.executor
        .select({
          id: evidence.id,
          sourceRecordKey: evidence.sourceRecordKey,
          contentSha256: evidence.contentSha256,
        })
        .from(evidence)
        .where(
          and(
            eq(evidence.sourceKey, sourceKey),
            inArray(
              evidence.sourceRecordKey,
              missing.map((record) => record.sourceRecordKey),
            ),
          ),
        );
      const wanted = new Map(
        missing.map((record) => [record.sourceRecordKey, record.contentSha256]),
      );
      for (const row of existing) {
        if (wanted.get(row.sourceRecordKey) === row.contentSha256) {
          result.set(row.sourceRecordKey, { id: row.id, created: false });
        }
      }
    }
    if (result.size !== records.length)
      throw new Error('Evidence could not be resolved for every record');
    return result;
  }

  async upsertCandidates(
    researchCampaignId: string,
    sourceKey: SourceKey,
    runId: string,
    upserts: CandidateUpsert[],
  ): Promise<Map<string, { id: string; created: boolean }>> {
    const result = new Map<string, { id: string; created: boolean }>();
    for (const batch of batches(upserts)) {
      const now = new Date();
      const rows = await this.database.executor
        .insert(candidates)
        .values(
          batch.map((candidate) => ({
            id: uuidV7(),
            researchCampaignId,
            sourceKey,
            kind: 'offer',
            ...candidate,
            firstSeenRunId: runId,
            lastSeenRunId: runId,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [candidates.researchCampaignId, candidates.sourceKey, candidates.sourceRecordKey],
          set: {
            latestEvidenceId: sql`excluded.latest_evidence_id`,
            displayName: sql`excluded.display_name`,
            countyCode: sql`excluded.county_code`,
            settlementName: sql`excluded.settlement_name`,
            screeningClass: sql`excluded.screening_class`,
            lastSeenRunId: sql`excluded.last_seen_run_id`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning({
          id: candidates.id,
          sourceRecordKey: candidates.sourceRecordKey,
          created: sql<boolean>`(xmax = 0)`,
        });
      for (const row of rows) {
        result.set(row.sourceRecordKey, { id: row.id, created: row.created });
      }
    }
    return result;
  }

  /** Inserts Claims not yet proposed by the same method from the same Evidence. */
  async storeClaims(runId: string, observedAt: Date, newClaims: NewClaim[]): Promise<number> {
    let created = 0;
    for (const batch of batches(newClaims)) {
      const now = new Date();
      const rows = await this.database.executor
        .insert(claims)
        .values(
          batch.map((claim) => ({
            id: uuidV7(),
            ...claim,
            acquisitionRunId: runId,
            observedAt,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing({
          target: [claims.candidateId, claims.evidenceId, claims.target, claims.extractionMethod],
        })
        .returning({ id: claims.id });
      created += rows.length;
    }
    return created;
  }

  async storeRunRecords(runId: string, records: NewRunRecord[]): Promise<void> {
    for (const batch of batches(records)) {
      const now = new Date();
      await this.database.executor.insert(acquisitionRunRecords).values(
        batch.map((record) => ({
          id: uuidV7(),
          acquisitionRunId: runId,
          ...record,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }
}
