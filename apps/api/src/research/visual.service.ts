import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { z } from 'zod';

import { AuditRepository } from '../audit';
import { AuthenticationError, NotFoundError, PreconditionError } from '../common';
import type { AppClsStore } from '../common';
import { UnitOfWork, uuidV7 } from '../database';
import { canonicalJson, sha256Hex } from './acquisition/source-record';
import { AcquisitionRepository } from './acquisition.repository';
import { AcquisitionQueryRepository } from './acquisition-query.repository';
import { privateDirectory, writeJson } from './extraction/files';
import { MATCHER_VERSION } from './matching/duplicate-matcher';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { downloadCommonsImage, readCommonsMetadata, textFromMetadata } from './visual/commons';
import { imageSchema } from './visual/contracts';
import type { ImageEvidencePayload, VisualEntry } from './visual/contracts';
import { imageManifest, partitionImages, VISUAL_CORPUS_VERSION } from './visual/corpus';
import type { VisualCorpus } from './visual/corpus';
import { imagePath, readVisualCorpus, storeImage } from './visual/files';
import { IMAGE_PROCESSING_VERSION, ImageIntegrityError, inspectImage } from './visual/integrity';
import { visualSpecification } from './visual/specification';
import { annotationSchema, annotationTemplate, evaluateVisual } from './visual/evaluation';
import { visionProtocol, importVisionCapture } from './visual/vision';
import { persistVisualObservations } from './visual-persistence';
import { VisualRepository } from './visual.repository';

@Injectable()
export class VisualService {
  constructor(
    private readonly repository: VisualRepository,
    private readonly acquisitions: AcquisitionRepository,
    private readonly queries: AcquisitionQueryRepository,
    private readonly campaigns: ResearchCampaignRepository,
    private readonly audit: AuditRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  private administrator() {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) throw new AuthenticationError('Administrator required');
    return administrator;
  }

  async acquire(campaignId: string, out: string) {
    this.administrator();
    if ((await this.campaigns.findById(campaignId)) === undefined)
      throw new NotFoundError('Research Campaign does not exist');
    const directory = privateDirectory(out);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = await open(join(directory, 'sample.lock'), 'wx');
    await lock.close();
    const started = performance.now();
    const rows = await this.repository.frame(campaignId);
    const referenceCounts = await this.repository.referenceCounts(campaignId);
    const frame = rows.flatMap((row) => {
      const tag = z.object({ tags: z.object({ wikimedia_commons: z.string() }) }).parse(row.payload)
        .tags.wikimedia_commons;
      return tag.startsWith('File:') ? [{ ...row, title: tag }] : [];
    });
    if (frame.length !== 3)
      throw new PreconditionError(
        'Frozen visual frame requires exactly three direct File references; document a new protocol before changing it',
      );
    await writeJson(directory, 'frame.private.json', frame);
    const metadata = await readCommonsMetadata(frame.map((row) => row.title)).catch(
      async (error: unknown) => {
        await writeJson(
          directory,
          'failures.json',
          frame.map((row) => ({
            sourceRecordKey: row.sourceRecordKey,
            code: 'image.metadata_acquisition_failed',
          })),
        );
        throw new PreconditionError(
          'Image metadata acquisition failed; sealed frame retained without replacement',
          { cause: error },
        );
      },
    );
    await writeJson(directory, 'commons-response.private.json', metadata);
    const entries: Omit<VisualEntry, 'partition' | 'group'>[] = [];
    const failures: { sourceRecordKey: string; code: string }[] = [];
    const timings: number[] = [];
    for (const row of frame) {
      const itemStarted = performance.now();
      try {
        const info = metadata.pages.find((page) => page.title === row.title)?.imageinfo?.[0];
        if (info === undefined) throw new ImageIntegrityError('image.source_missing');
        const downloaded = await downloadCommonsImage(info);
        const checked = await inspectImage(downloaded.bytes);
        if (checked.width !== info.width || checked.height !== info.height)
          throw new ImageIntegrityError('image.source_dimensions');
        await storeImage(checked.sha256, downloaded.bytes, checked.preview);
        const image = imageSchema.parse({
          kind: 'authorized_image@1',
          title: row.title,
          sourcePage: downloaded.permission.sourcePage,
          imageUrl: downloaded.permission.imageUrl,
          sourceVersion: `${info.timestamp}:${info.sha1}`,
          sourceSha1: info.sha1,
          sha256: checked.sha256,
          byteSize: checked.byteSize,
          width: checked.width,
          height: checked.height,
          format: checked.format,
          dHash: checked.dHash,
          previewSha256: checked.previewSha256,
          processingVersion: checked.processingVersion,
          retrievedAt: downloaded.retrievedAt,
          captureDate: info.extmetadata.DateTimeOriginal?.value ?? null,
          caption: textFromMetadata(info.extmetadata.ImageDescription?.value ?? ''),
          relationshipContext: `OSM wikimedia_commons=${row.title}`,
          relationship: 'source_tag_reference',
          attributionReview: 'unreviewed',
          privacyReview: 'not_cleared_for_external_processing',
          rights: {
            access: true,
            download: true,
            retain: true,
            localAnalysis: true,
            thirdPartyAnalysis: 'requires_explicit_authorization',
            publication: 'not_authorized_by_experiment',
            licence: downloaded.permission.licence,
            licenceUrl: downloaded.permission.licenceUrl,
            credit: downloaded.permission.credit,
            permissionSource: downloaded.permission.sourcePage,
            checkedAt: metadata.retrievedAt,
          },
        });
        const stored = await this.storeImageEvidence(
          campaignId,
          row.candidateId,
          row.sourceEvidenceId,
          row.sourceEvidenceSha256,
          image,
        );
        entries.push({
          candidateId: row.candidateId,
          sourceEvidenceId: row.sourceEvidenceId,
          sourceEvidenceSha256: row.sourceEvidenceSha256,
          sourceRecordKey: row.sourceRecordKey,
          countyCode: row.countyCode,
          ...stored,
          image,
        });
      } catch (error) {
        const code =
          error instanceof ImageIntegrityError
            ? error.code
            : error instanceof Error && /^image\.[a-z0-9_]+$/.test(error.message)
              ? error.message
              : 'image.acquisition_failed';
        failures.push({ sourceRecordKey: row.sourceRecordKey, code });
        await writeJson(directory, 'failures.json', failures);
      }
      timings.push(performance.now() - itemStarted);
    }
    const grouped = partitionImages(
      entries,
      await this.repository.members(campaignId),
      await this.queries.suggestionEdges(campaignId, MATCHER_VERSION),
    );
    const { entries: finalEntries, ...grouping } = grouped;
    const { manifest, manifestSha256 } = imageManifest(
      campaignId,
      finalEntries,
      failures,
      {
        categoryReferences: rows.length - frame.length,
        otherImageHosts: referenceCounts.imageTags - referenceCounts.commonsImageUrls,
      },
      grouping,
    );
    const corpus: VisualCorpus = {
      version: VISUAL_CORPUS_VERSION,
      campaignId,
      entries: finalEntries,
      manifestSha256,
    };
    await writeJson(directory, 'corpus.private.json', corpus);
    await writeJson(directory, 'manifest.json', manifest);
    await writeJson(directory, 'observability.json', visualSpecification());
    await writeJson(directory, 'annotation-template.private.json', annotationTemplate(corpus));
    await writeJson(directory, 'annotation-schema.json', z.toJSONSchema(annotationSchema));
    await writeJson(directory, 'vision-protocol.json', visionProtocol());
    const execution = {
      status:
        entries.length === 0
          ? 'failed'
          : failures.length > 0
            ? 'completed_with_rejections'
            : 'succeeded',
      version: IMAGE_PROCESSING_VERSION,
      attempts: frame.length,
      successes: entries.length,
      failures,
      elapsedMs: performance.now() - started,
      perImageMs: timings,
      retainedOriginalBytes: entries.reduce((n, entry) => n + entry.image.byteSize, 0),
      duplicatePairs: grouped.exactDuplicates,
      nearDuplicatePairs: grouped.nearDuplicatePairs,
      externalModelCalls: 0,
      observedPaidAcquisitionCost: { amount: 0, currency: 'EUR' },
      modelCost: { amount: 0, currency: 'EUR' },
      computeStorageAndEngineeringCost: null,
    };
    await writeJson(directory, 'execution.json', execution);
    return { manifestSha256, ...execution };
  }

  private async storeImageEvidence(
    campaignId: string,
    candidateId: string,
    sourceEvidenceId: string,
    sourceEvidenceSha256: string,
    image: ImageEvidencePayload,
  ) {
    const parent = await this.repository.linked(campaignId, candidateId, sourceEvidenceId);
    if (parent?.contentSha256 !== sourceEvidenceSha256)
      throw new PreconditionError('Image source association differs from pinned Evidence');
    const administrator = this.administrator();
    return this.unitOfWork.run(async () => {
      const artifact = await this.acquisitions.registerArtifact({
        sourceKey: 'wikimedia_commons_images',
        originalUrl: image.imageUrl,
        fileName: `${image.sha256}.${image.format}`,
        mediaType: `image/${image.format}`,
        byteSize: image.byteSize,
        sha256: image.sha256,
        retrievedAt: new Date(image.retrievedAt),
        reuseTerms: 'per_file_licence',
        retentionPolicy: 'full_record',
      });
      await this.acquisitions.recordArtifactVersion(artifact.id, image.sourceVersion, {
        licence: image.rights.licence,
        licenceUrl: image.rights.licenceUrl,
        sourcePage: image.sourcePage,
        credit: image.rights.credit,
      });
      const runId = uuidV7();
      await this.acquisitions.createRun({
        id: runId,
        researchCampaignId: campaignId,
        sourceKey: 'wikimedia_commons_images',
        sourceArtifactId: artifact.id,
        parserVersion: IMAGE_PROCESSING_VERSION,
        normalizerVersion: IMAGE_PROCESSING_VERSION,
        administratorId: administrator.id,
        startedAt: new Date(),
      });
      const digest = sha256Hex(canonicalJson(image));
      const stored = (
        await this.acquisitions.storeEvidence(
          'wikimedia_commons_images',
          artifact.id,
          new Date(image.retrievedAt),
          [
            {
              sourceRecordKey: image.title,
              sourceRecordUrl: image.sourcePage,
              contentSha256: digest,
              payload: image,
              redactedFields: [],
            },
          ],
        )
      ).get(image.title);
      if (stored === undefined) throw new Error('Image Evidence not stored');
      await this.acquisitions.storeRunRecords(runId, [
        {
          evidenceId: stored.id,
          position: 1,
          evidenceOutcome: stored.created ? 'created' : 'unchanged',
          extractionStatus: 'parsed',
          errors: [],
          inCampaignScope: false,
          candidateId,
        },
      ]);
      await this.acquisitions.finishRun(runId, {
        status: 'succeeded',
        stats: {
          recordsRead: 1,
          recordsParsed: 1,
          recordsRejected: 0,
          evidenceCreated: stored.created ? 1 : 0,
          evidenceUnchanged: stored.created ? 0 : 1,
          candidatesCreated: 0,
          claimsCreated: 0,
          claimsUnchanged: 0,
          sourceEvidenceId,
          sourceEvidenceSha256,
          association: 'unreviewed',
          imageSha256: image.sha256,
        },
        outputDigest: digest,
        failure: null,
      });
      await this.audit.record({
        action: 'visual_image.imported',
        targetType: 'AcquisitionRun',
        targetId: runId,
        administratorId: administrator.id,
        metadata: { imageSha256: image.sha256, sourceEvidenceId, evidenceCreated: stored.created },
      });
      return { evidenceId: stored.id, artifactId: artifact.id };
    });
  }

  async replay(sample: string) {
    const corpus = await readVisualCorpus(sample);
    for (const entry of corpus.entries) {
      const checked = await inspectImage(await readFile(imagePath(entry.image.sha256)));
      if (
        checked.previewSha256 !== entry.image.previewSha256 ||
        checked.dHash !== entry.image.dHash
      )
        throw new PreconditionError('Image processing differs from pinned version');
      const stored = await this.storeImageEvidence(
        corpus.campaignId,
        entry.candidateId,
        entry.sourceEvidenceId,
        entry.sourceEvidenceSha256,
        entry.image,
      );
      if (stored.evidenceId !== entry.evidenceId || stored.artifactId !== entry.artifactId)
        throw new PreconditionError('Pinned image identity differs');
    }
    return {
      replayedImages: corpus.entries.length,
      externalCalls: 0,
      newCandidates: 0,
      proposedVisualClaims: 0,
    };
  }

  async preview(campaignId: string, candidateId: string, evidenceId: string) {
    const row = await this.repository.linked(campaignId, candidateId, evidenceId);
    const parsed = imageSchema.safeParse(row?.payload);
    if (!parsed.success || row?.contentSha256 !== sha256Hex(canonicalJson(parsed.data)))
      throw new NotFoundError('Authorized image Evidence not found');
    const data = await readFile(imagePath(parsed.data.sha256, true));
    if (sha256Hex(data) !== parsed.data.previewSha256)
      throw new PreconditionError('Preview fingerprint mismatch');
    return data;
  }

  async importAi(sample: string, artifact: string) {
    const administrator = this.administrator();
    const corpus = await readVisualCorpus(sample);
    const raw: unknown = JSON.parse(await readFile(artifact, 'utf8'));
    const imported = importVisionCapture(raw, corpus);
    const history = join(sample, 'runs', imported.method);
    const captureSha256 = sha256Hex(canonicalJson(raw));
    await writeJson(history, `${captureSha256}.capture.private.json`, raw);
    await writeJson(history, `${captureSha256}.validation.private.json`, imported);
    await writeJson(sample, 'vision-import.private.json', imported);
    const results = [];
    for (const result of imported.results) {
      if (result.accepted === null) continue;
      const output = result.accepted;
      const entry = corpus.entries.find((item) => item.evidenceId === result.evidenceId);
      if (entry === undefined) throw new PreconditionError('Unknown image Evidence');
      const row = await this.repository.linked(
        corpus.campaignId,
        entry.candidateId,
        entry.evidenceId,
      );
      if (row?.contentSha256 !== sha256Hex(canonicalJson(entry.image)))
        throw new PreconditionError('Pinned Evidence differs');
      results.push(
        await this.unitOfWork.run(async () => {
          const runId = uuidV7();
          await this.acquisitions.createRun({
            id: runId,
            researchCampaignId: corpus.campaignId,
            sourceKey: 'wikimedia_commons_images',
            sourceArtifactId: entry.artifactId,
            parserVersion: imported.method,
            normalizerVersion: imported.method,
            administratorId: administrator.id,
            startedAt: new Date(),
            stage: 'extract',
          });
          return persistVisualObservations(
            {
              entry,
              output,
              metadata: imported.metadata,
              method: imported.method,
              runId,
              administratorId: administrator.id,
            },
            this.acquisitions,
            this.audit,
          );
        }),
      );
    }
    return {
      accepted: results.length,
      rejected: imported.results.length - results.length,
      results,
    };
  }

  async score(sample: string, labels: string[], capture?: string) {
    const corpus = await readVisualCorpus(sample);
    await writeJson(sample, 'annotation-template.private.json', annotationTemplate(corpus));
    await writeJson(sample, 'annotation-schema.json', z.toJSONSchema(annotationSchema));
    await writeJson(sample, 'vision-protocol.json', visionProtocol());
    const annotationInputs: unknown[] = await Promise.all(
      labels.map(async (path) => JSON.parse(await readFile(path, 'utf8')) as unknown),
    );
    const model =
      capture === undefined
        ? null
        : importVisionCapture(JSON.parse(await readFile(capture, 'utf8')), corpus);
    const report = evaluateVisual(
      corpus,
      annotationInputs,
      model,
      await this.repository.textClaims(corpus.entries.map((entry) => entry.candidateId)),
    );
    await writeJson(sample, 'quality-report.json', report);
    return report;
  }
}
