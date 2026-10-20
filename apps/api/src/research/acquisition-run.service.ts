import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { AuditRepository } from '../audit';
import { type AppClsStore, AuthenticationError, NotFoundError, PreconditionError } from '../common';
import { UnitOfWork, uuidV7 } from '../database';
import { countyCodeFromName, type CountyCode } from './acquisition/romania-geography';
import { SOURCE_DEFINITIONS } from './acquisition/sources';
import {
  ArtifactFormatError,
  canonicalJson,
  type JsonObject,
  sha256Hex,
  type SourceArtifactReading,
  type SourceKey,
  type SourceRecord,
  storedPayload,
} from './acquisition/source-record';
import { foldText } from './acquisition/text-normalization';
import { AcquisitionRepository, type AcquisitionRunStatus } from './acquisition.repository';
import { ResearchCampaignRepository } from './research-campaign.repository';

/** Provenance of a downloaded artifact, written next to it by the `fetch` command. */
export interface ArtifactManifest {
  sourceKey: SourceKey;
  originalUrl: string;
  retrievedAt: string;
  fileName: string;
  sha256: string;
  byteSize: number;
}

export interface AcquisitionRunOutcome {
  runId: string;
  status: Exclude<AcquisitionRunStatus, 'running'>;
  stats: JsonObject;
  outputDigest: string | null;
  failure: { code: string; message: string } | null;
}

class RunFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/**
 * Digest of everything an artifact was interpreted as: every Claim and every
 * rejection, sorted. Equal digests prove that fixed inputs and fixed parser
 * and normalizer versions produced identical outputs.
 */
export function outputDigest(records: SourceRecord[], defaultMethod: string): string {
  const lines: string[] = [];
  for (const record of records) {
    if (record.status === 'rejected') {
      lines.push(
        `${record.sourceRecordKey}\t!rejected\t${record.errors.map((error) => error.code).join(',')}`,
      );
      continue;
    }
    for (const claim of record.claims) {
      lines.push(
        `${record.sourceRecordKey}\t${claim.target}\t${claim.extractionMethod ?? defaultMethod}\t${canonicalJson(claim.value)}`,
      );
    }
  }
  return sha256Hex(lines.sort().join('\n'));
}

interface CampaignScope {
  countyCode: CountyCode | null;
  locality: string | null;
}

function inCampaignScope(record: SourceRecord, scope: CampaignScope): boolean {
  if (record.status !== 'parsed' || record.summary === null) return false;
  if (scope.countyCode !== null && record.summary.countyCode !== scope.countyCode) return false;
  if (scope.locality === null) return true;
  return record.scopeSettlements.some((settlement) => foldText(settlement) === scope.locality);
}

/**
 * Runs one import of a versioned source artifact for a Research Campaign.
 *
 * Transaction boundaries: the run and its artifact are registered and
 * committed first, so every attempt is recorded. All Evidence, Candidates,
 * Claims, and per-record outcomes are then written in one transaction; any
 * failure rolls them back together and the run is marked `failed`. Imports
 * are idempotent: identical Evidence, Candidates, and Claims are reused.
 */
@Injectable()
export class AcquisitionRunService {
  constructor(
    private readonly acquisitions: AcquisitionRepository,
    private readonly campaigns: ResearchCampaignRepository,
    private readonly audit: AuditRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async importArtifact(input: {
    researchCampaignId: string;
    artifactPath: string;
    manifest: ArtifactManifest;
  }): Promise<AcquisitionRunOutcome> {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) {
      throw new AuthenticationError('No administrator resolved for this acquisition run');
    }
    const campaign = await this.campaigns.findById(input.researchCampaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`Research Campaign ${input.researchCampaignId} does not exist`);
    }
    const source = SOURCE_DEFINITIONS[input.manifest.sourceKey];
    const countyCode = campaign.county === null ? null : countyCodeFromName(campaign.county);
    if (campaign.county !== null && countyCode === null) {
      throw new PreconditionError(`Campaign county ${campaign.county} is not a Romanian county`);
    }
    const scope: CampaignScope = {
      countyCode,
      locality: campaign.locality === null ? null : foldText(campaign.locality),
    };

    const [sha256, fileStat] = await Promise.all([
      fileSha256(input.artifactPath),
      stat(input.artifactPath),
    ]);
    const runId = uuidV7();
    const startedAt = new Date();

    const artifact = await this.unitOfWork.run(async () => {
      const registered = await this.acquisitions.registerArtifact({
        sourceKey: source.key,
        originalUrl: input.manifest.originalUrl,
        fileName: input.manifest.fileName,
        mediaType: source.mediaType,
        byteSize: fileStat.size,
        sha256,
        retrievedAt: new Date(input.manifest.retrievedAt),
        reuseTerms: source.reuseTerms,
        retentionPolicy: source.retentionPolicy,
      });
      await this.acquisitions.createRun({
        id: runId,
        researchCampaignId: campaign.id,
        sourceKey: source.key,
        sourceArtifactId: registered.id,
        parserVersion: source.parserVersion,
        normalizerVersion: source.normalizerVersion,
        administratorId: administrator.id,
        startedAt,
      });
      await this.audit.record({
        action: 'acquisition_run.started',
        targetType: 'AcquisitionRun',
        targetId: runId,
        administratorId: administrator.id,
        metadata: { researchCampaignId: campaign.id, sourceKey: source.key, sha256 },
      });
      return registered;
    });

    try {
      if (sha256 !== input.manifest.sha256) {
        throw new RunFailure(
          'artifact.checksum_mismatch',
          `Artifact checksum ${sha256} differs from the manifest ${input.manifest.sha256}`,
        );
      }

      let reading: SourceArtifactReading;
      try {
        reading = await source.read(input.artifactPath);
      } catch (error) {
        if (error instanceof ArtifactFormatError) throw new RunFailure(error.code, error.message);
        throw error;
      }
      if (artifact.datasetVersion !== null && artifact.datasetVersion !== reading.datasetVersion) {
        throw new RunFailure(
          'artifact.version_conflict',
          `Artifact was previously read as ${artifact.datasetVersion}, now ${reading.datasetVersion}`,
        );
      }
      const rejected = reading.records.filter((record) => record.status === 'rejected');
      if (rejected.length > reading.records.length * source.maxRejectedRatio) {
        throw new RunFailure(
          'acquisition.rejection_threshold_exceeded',
          `${String(rejected.length)} of ${String(reading.records.length)} records were rejected`,
        );
      }

      const outcome = await this.unitOfWork.run(async () => {
        const stats = await this.persist(runId, campaign.id, artifact.id, reading, scope);
        stats.durationMs = Date.now() - startedAt.getTime();
        const status = rejected.length > 0 ? 'completed_with_rejections' : 'succeeded';
        const digest = outputDigest(reading.records, reading.normalizerVersion);
        await this.acquisitions.recordArtifactVersion(artifact.id, reading.datasetVersion, {
          ...reading.metadata,
          attribution: source.attribution,
        });
        await this.acquisitions.finishRun(runId, {
          status,
          stats,
          outputDigest: digest,
          failure: null,
        });
        await this.audit.record({
          action: 'acquisition_run.completed',
          targetType: 'AcquisitionRun',
          targetId: runId,
          administratorId: administrator.id,
          metadata: { status, outputDigest: digest },
        });
        return { runId, status, stats, outputDigest: digest, failure: null } as const;
      });
      return outcome;
    } catch (error) {
      const failure =
        error instanceof RunFailure
          ? { code: error.code, message: error.message }
          : {
              code: 'acquisition.unexpected_error',
              message: error instanceof Error ? error.message : String(error),
            };
      await this.unitOfWork.run(async () => {
        await this.acquisitions.finishRun(runId, {
          status: 'failed',
          stats: { durationMs: Date.now() - startedAt.getTime() },
          outputDigest: null,
          failure,
        });
        await this.audit.record({
          action: 'acquisition_run.failed',
          targetType: 'AcquisitionRun',
          targetId: runId,
          administratorId: administrator.id,
          metadata: failure,
        });
      });
      return { runId, status: 'failed', stats: {}, outputDigest: null, failure };
    }
  }

  private async persist(
    runId: string,
    researchCampaignId: string,
    artifactId: string,
    reading: SourceArtifactReading,
    scope: CampaignScope,
  ): Promise<JsonObject> {
    const evidenceIds = await this.acquisitions.storeEvidence(
      reading.sourceKey,
      artifactId,
      reading.observedAt,
      reading.records.map((record) => ({
        sourceRecordKey: record.sourceRecordKey,
        sourceRecordUrl: record.sourceRecordUrl,
        // The checksum covers the complete source record, before redaction.
        contentSha256: sha256Hex(canonicalJson(record.rawPayload)),
        payload: storedPayload(record),
        redactedFields: record.redactedFields,
      })),
    );
    const evidenceFor = (record: SourceRecord) => {
      const stored = evidenceIds.get(record.sourceRecordKey);
      if (stored === undefined) throw new Error(`Evidence missing for ${record.sourceRecordKey}`);
      return stored;
    };

    const scoped = reading.records.filter((record) => inCampaignScope(record, scope));
    const candidateIds = await this.acquisitions.upsertCandidates(
      researchCampaignId,
      reading.sourceKey,
      runId,
      scoped.map((record) => ({
        sourceRecordKey: record.sourceRecordKey,
        latestEvidenceId: evidenceFor(record).id,
        displayName: record.summary?.displayName ?? record.sourceRecordKey,
        countyCode: record.summary?.countyCode ?? null,
        settlementName: record.summary?.settlementName ?? null,
        screeningClass: record.summary?.screeningClass ?? 'insufficient_data',
      })),
    );

    const newClaims = scoped.flatMap((record) => {
      const candidate = candidateIds.get(record.sourceRecordKey);
      if (candidate === undefined) return [];
      return record.claims.map((claim) => ({
        candidateId: candidate.id,
        evidenceId: evidenceFor(record).id,
        target: claim.target,
        value: claim.value,
        evidenceLocator: claim.locator,
        extractionMethod: claim.extractionMethod ?? reading.normalizerVersion,
        confidence: claim.confidence,
      }));
    });
    const claimsCreated = await this.acquisitions.storeClaims(runId, reading.observedAt, newClaims);

    await this.acquisitions.storeRunRecords(
      runId,
      reading.records.map((record) => {
        const stored = evidenceFor(record);
        return {
          evidenceId: stored.id,
          position: record.position,
          evidenceOutcome: stored.created ? 'created' : 'unchanged',
          extractionStatus: record.status,
          errors: record.errors,
          inCampaignScope: inCampaignScope(record, scope),
          candidateId: candidateIds.get(record.sourceRecordKey)?.id ?? null,
        };
      }),
    );

    const rejectionsByCode: Record<string, number> = {};
    for (const record of reading.records) {
      for (const error of record.errors) {
        rejectionsByCode[error.code] = (rejectionsByCode[error.code] ?? 0) + 1;
      }
    }
    const createdEvidence = [...evidenceIds.values()].filter((stored) => stored.created).length;
    const createdCandidates = [...candidateIds.values()].filter((stored) => stored.created).length;
    return {
      datasetVersion: reading.datasetVersion,
      recordsRead: reading.records.length,
      recordsParsed: reading.records.filter((record) => record.status === 'parsed').length,
      recordsRejected: reading.records.filter((record) => record.status === 'rejected').length,
      rejectionsByCode,
      excludedBySource: reading.excluded,
      evidenceCreated: createdEvidence,
      evidenceUnchanged: evidenceIds.size - createdEvidence,
      recordsInCampaignScope: scoped.length,
      candidatesCreated: createdCandidates,
      candidatesUpdated: candidateIds.size - createdCandidates,
      claimsCreated,
      claimsUnchanged: newClaims.length - claimsCreated,
    };
  }
}
