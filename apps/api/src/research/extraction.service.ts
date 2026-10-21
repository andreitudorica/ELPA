import { mkdir, readFile } from 'node:fs/promises';
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
import { CandidateClaimsRepository } from './candidate-claims.repository';
import { aiProtocol, importCapturedRun } from './extraction/ai';
import { compareMethods } from './extraction/comparison';
import { outputSchema } from './extraction/contracts';
import { sampleCorpus } from './extraction/corpus';
import { DETERMINISTIC_VERSION, extractDeterministically } from './extraction/deterministic';
import { PROJECTION_VERSION } from './extraction/documents';
import {
  annotationSchema,
  annotationTemplate,
  evaluateExtraction,
  predictionId,
} from './extraction/evaluation';
import { privateDirectory, readCorpus, writeJson } from './extraction/files';
import { ontologyDocument } from './extraction/ontology';
import { observedReport } from './extraction/report';
import { ExtractionRepository } from './extraction.repository';
import { persistExtraction } from './extraction-persistence';
import { MATCHER_VERSION } from './matching/duplicate-matcher';
import { ResearchCampaignRepository } from './research-campaign.repository';

@Injectable()
export class ExtractionService {
  constructor(
    private readonly repository: ExtractionRepository,
    private readonly acquisitions: AcquisitionRepository,
    private readonly queries: AcquisitionQueryRepository,
    private readonly candidateClaims: CandidateClaimsRepository,
    private readonly campaigns: ResearchCampaignRepository,
    private readonly audit: AuditRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async exportCorpus(campaignId: string, out: string) {
    if ((await this.campaigns.findById(campaignId)) === undefined)
      throw new NotFoundError('Research Campaign does not exist');
    const directory = privateDirectory(out);
    // Never silently redraw an existing sealed sample after data or rules change.
    await mkdir(directory, { recursive: true });
    const lock = await import('node:fs/promises').then((fs) =>
      fs.open(join(directory, 'sample.lock'), 'wx'),
    );
    await lock.close();
    const [documents, claimSets, edges] = await Promise.all([
      this.repository.loadDocuments(campaignId),
      this.candidateClaims.loadLatestClaims(campaignId, ['offer.primary_locality']),
      this.queries.suggestionEdges(campaignId, MATCHER_VERSION),
    ]);
    if (edges.length === 0)
      throw new PreconditionError('Run existing duplicate detection before drawing the corpus');
    const urbanities = new Map(
      claimSets.map((set) => {
        const locality = z
          .object({ urbanity: z.enum(['urban', 'rural', 'unknown']) })
          .safeParse(set.claims['offer.primary_locality']);
        return [set.id, locality.success ? locality.data.urbanity : 'unknown'];
      }),
    );
    const frame = documents.map((entry) => ({
      ...entry,
      urbanity: urbanities.get(entry.document.candidateId) ?? 'unknown',
    }));
    const { corpus, manifest } = sampleCorpus(campaignId, frame, edges);
    await writeJson(directory, 'manifest.json', manifest);
    await writeJson(directory, 'corpus.private.json', corpus);
    await writeJson(directory, 'annotation-template.private.json', annotationTemplate(corpus));
    await writeJson(directory, 'annotation-schema.json', z.toJSONSchema(annotationSchema));
    await writeJson(directory, 'ontology.json', ontologyDocument());
    await writeJson(directory, 'ai-protocol.json', aiProtocol());
    return { directory, manifestSha256: corpus.manifestSha256, ...manifest, items: undefined };
  }

  async run(campaignId: string, sample: string) {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined)
      throw new AuthenticationError('No Administrator for extraction');
    const corpus = await readCorpus(sample);
    if (corpus.campaignId !== campaignId)
      throw new PreconditionError('Corpus belongs to another campaign');
    const retained = await this.repository.loadDocuments(
      campaignId,
      corpus.entries.map((entry) => entry.document.evidenceId),
    );
    const originals = new Map(
      retained.map((entry) => [entry.document.id, canonicalJson(entry.document)]),
    );
    if (
      corpus.entries.some(
        (entry) => originals.get(entry.document.id) !== canonicalJson(entry.document),
      )
    )
      throw new PreconditionError('Corpus no longer matches retained primary Evidence');
    const started = performance.now();
    const outputs = corpus.entries.map((entry) => extractDeterministically(entry.document));
    const processingMs = performance.now() - started;
    const groups = new Map<string, typeof corpus.entries>();
    for (const entry of corpus.entries)
      groups.set(entry.document.artifactId, [
        ...(groups.get(entry.document.artifactId) ?? []),
        entry,
      ]);
    const outcomes = [];
    for (const [artifactId, entries] of groups) {
      const first = entries[0];
      if (first === undefined) continue;
      const runId = uuidV7();
      const startedAt = new Date();
      await this.unitOfWork.run(async () => {
        await this.acquisitions.createRun({
          id: runId,
          researchCampaignId: campaignId,
          sourceKey: first.document.sourceKey,
          sourceArtifactId: artifactId,
          parserVersion: PROJECTION_VERSION,
          normalizerVersion: DETERMINISTIC_VERSION,
          administratorId: administrator.id,
          startedAt,
          stage: 'extract',
        });
        await this.audit.record({
          action: 'extraction_run.started',
          targetType: 'AcquisitionRun',
          targetId: runId,
          administratorId: administrator.id,
          metadata: { corpusManifestSha256: corpus.manifestSha256, method: DETERMINISTIC_VERSION },
        });
      });
      try {
        const result = await persistExtraction(
          {
            runId,
            administratorId: administrator.id,
            entries,
            outputs: outputs.filter((output) =>
              entries.some((entry) => entry.document.id === output.documentId),
            ),
            manifestSha256: corpus.manifestSha256,
          },
          {
            runInTransaction: (work) => this.unitOfWork.run(work),
            storeClaims: (id, at, claims) => this.acquisitions.storeClaims(id, at, claims),
            storeRunRecords: (id, records) => this.acquisitions.storeRunRecords(id, records),
            finishRun: (id, outcome) => this.acquisitions.finishRun(id, outcome),
            audit: (event) => this.audit.record(event),
          },
        );
        outcomes.push(result);
      } catch (error) {
        await this.unitOfWork.run(async () => {
          const failure = {
            code: 'extraction.failed',
            message:
              'Extraction transaction failed; inspect local logs without exposing source text.',
          };
          await this.acquisitions.finishRun(runId, {
            status: 'failed',
            stats: {},
            outputDigest: null,
            failure,
          });
          await this.audit.record({
            action: 'extraction_run.failed',
            targetType: 'AcquisitionRun',
            targetId: runId,
            administratorId: administrator.id,
            metadata: failure,
          });
        });
        throw error;
      }
    }
    const observation = {
      corpusManifestSha256: corpus.manifestSha256,
      method: DETERMINISTIC_VERSION,
      documents: outputs.length,
      proposedFacts: outputs.reduce((sum, output) => sum + output.facts.length, 0),
      processingMs,
      externalCalls: 0,
      observedExternalCost: { amount: 0, currency: 'EUR' },
      localComputeAndStorageCost: null,
      engineeringCost: null,
      ai: 'not_executed',
      outcomes,
    };
    await writeJson(sample, 'deterministic-output.private.json', outputs);
    await writeJson(sample, 'execution.json', observation);
    const historyDirectory = join(sample, 'runs', DETERMINISTIC_VERSION);
    await writeJson(historyDirectory, 'deterministic-output.private.json', outputs);
    await writeJson(
      historyDirectory,
      `execution-${outcomes[0]?.runId ?? 'empty'}.json`,
      observation,
    );
    await writeJson(
      sample,
      'prediction-review.private.json',
      outputs.map((output) => ({
        documentId: output.documentId,
        facts: output.facts.map((fact) => ({ factId: predictionId(fact), fact })),
      })),
    );
    return observation;
  }

  async score(sample: string, labelPaths: string[], aiPath?: string) {
    const corpus = await readCorpus(sample);
    await writeJson(sample, 'annotation-schema.json', z.toJSONSchema(annotationSchema));
    const raw: unknown = JSON.parse(
      await readFile(join(sample, 'deterministic-output.private.json'), 'utf8'),
    );
    const outputs = z.array(outputSchema).parse(raw);
    const labels: unknown[] = await Promise.all(
      labelPaths.map(async (path) => JSON.parse(await readFile(path, 'utf8')) as unknown),
    );
    const score = evaluateExtraction(corpus, outputs, labels);
    await writeJson(sample, 'deterministic-score.json', score);
    const captured: unknown =
      aiPath === undefined ? undefined : JSON.parse(await readFile(aiPath, 'utf8'));
    const ai = captured === undefined ? undefined : importCapturedRun(captured, corpus);
    const comparison = compareMethods(corpus, outputs, labels, ai);
    await writeJson(sample, 'method-comparison.json', comparison);
    return {
      status: score.status,
      holdoutDocuments: score.holdoutDocuments,
      scoredHoldoutCells: score.scoredHoldoutCells,
      groundingFailures: score.grounding.failures,
      ai: comparison.aiStatus,
      written: ['deterministic-score.json', 'method-comparison.json'],
    };
  }

  async importAi(sample: string, path: string) {
    const corpus = await readCorpus(sample);
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    const imported = importCapturedRun(raw, corpus);
    await writeJson(sample, 'ai-import.private.json', imported);
    // Hashes/counts only on stdout; quarantined results remain private.
    return {
      acceptedDocuments: imported.results.filter((result) => result.accepted !== null).length,
      rejectedDocuments: imported.results.filter((result) => result.accepted === null).length,
      captureSha256: sha256Hex(canonicalJson(raw)),
    };
  }

  async report(sample: string) {
    const corpus = await readCorpus(sample);
    const outputs = z
      .array(outputSchema)
      .parse(JSON.parse(await readFile(join(sample, 'deterministic-output.private.json'), 'utf8')));
    const prior = await this.repository.loadPriorClaims(
      corpus.entries.map((entry) => entry.document.candidateId),
    );
    const report = observedReport(corpus, outputs, prior);
    await writeJson(sample, 'observed-report.json', report);
    return report;
  }
}
