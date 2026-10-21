import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { AuditRepository } from '../audit';
import { type AppClsStore, NotFoundError, PreconditionError } from '../common';
import { UnitOfWork } from '../database';
import { canonicalJson, sha256Hex } from './acquisition/source-record';
import { AcquisitionQueryRepository } from './acquisition-query.repository';
import { projectFields } from './extraction/documents';
import { MATCHER_VERSION } from './matching/duplicate-matcher';
import { ReconciliationRepository } from './reconciliation.repository';
import { persistReconciliation } from './reconciliation-persistence';
import {
  CORPUS_VERSION,
  corpusSchema,
  type ReconciliationResult,
} from './reconciliation/contracts';
import { sampleGroups } from './reconciliation/corpus';
import { reconcile } from './reconciliation/engine';
import { reviewSchema, adjudicationSchema, scoreReconciliation } from './reconciliation/evaluation';
import { publicManifest, readReconciliationCorpus, writePrivate } from './reconciliation/files';
import { projectClaim } from './reconciliation/projection';
import { ResearchCampaignRepository } from './research-campaign.repository';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly repository: ReconciliationRepository,
    private readonly queries: AcquisitionQueryRepository,
    private readonly campaigns: ResearchCampaignRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditRepository,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async exportCorpus(campaignId: string, directory: string) {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) throw new PreconditionError('Administrator required');
    if ((await this.campaigns.findById(campaignId)) === undefined)
      throw new NotFoundError('Campaign not found');
    const [frame, members, edges] = await Promise.all([
      this.repository.frame(campaignId),
      this.queries.candidatesForClustering(campaignId),
      this.queries.suggestionEdges(campaignId, MATCHER_VERSION),
    ]);
    const sampling = sampleGroups(frame, members, edges);
    const ids = [...new Set(sampling.selected.flatMap((g) => g.candidateIds))];
    const rows = await this.repository.loadClaims(campaignId, ids);
    const selectedClaimIds = new Set(
      sampling.selected.flatMap((g) => g.rows.map((r) => r.claimId)),
    );
    if (rows.filter((r) => selectedClaimIds.has(r.id)).length !== selectedClaimIds.size)
      throw new PreconditionError('Frame changed during sampling; no replacement');
    const projected = rows.map(projectClaim).filter((p) => p !== null);
    const corpus = corpusSchema.parse({
      version: CORPUS_VERSION,
      campaignId,
      asOf: new Date().toISOString(),
      frameDigest: sampling.frameDigest,
      cases: sampling.selected.map((group) => ({
        id: sha256Hex(`${CORPUS_VERSION}:${group.group}`),
        anchorCandidateId: group.candidateIds[0],
        group: group.group,
        partition: group.partition,
        stratum: group.stratum,
        candidateIds: group.candidateIds,
        identity: 'candidate_scoped_unresolved_cross_candidate',
        identitySuggestionIds: edges
          .filter(
            (e) =>
              e.relation === 'same_property' &&
              group.candidateIds.includes(e.left) &&
              group.candidateIds.includes(e.right),
          )
          .map((e) => e.id)
          .sort(),
        propositions: projected.filter((p) => group.candidateIds.includes(p.candidateId)),
        lineage: [],
      })),
      evidenceSnapshots: [
        ...new Map(
          rows.map((row) => [
            row.evidence.id,
            {
              id: row.evidence.id,
              contentSha256: row.evidence.contentSha256,
              sourceKey: row.evidence.sourceKey,
              sourceRecordKey: row.evidence.sourceRecordKey,
              sourceRecordUrl: row.evidence.sourceRecordUrl,
              sourceVersion: row.evidence.sourceVersion ?? 'unknown',
              reuseTerms: row.evidence.reuseTerms,
              retentionPolicy: row.evidence.retentionPolicy,
              artifactSha256: row.evidence.artifactSha256,
              fields: projectFields(row.evidence.sourceKey, row.evidence.payload).fields,
            },
          ]),
        ).values(),
      ],
    });
    const manifest = publicManifest(corpus);
    await writePrivate(directory, 'corpus.private.json', corpus, true);
    await writePrivate(directory, 'manifest.json', manifest, true);
    await writePrivate(directory, 'sampling.json', sampling.summary, true);
    // Blind template: no predicted classifications or developer truth labels.
    await writePrivate(
      directory,
      'review-template.private.json',
      {
        corpusDigest: manifest.corpusDigest,
        reviewerId: null,
        reviewerKind: 'independent_human',
        reviews: corpus.cases
          .filter((c) => c.partition === 'holdout')
          .map((c) => ({
            caseId: c.id,
            evidenceInspected: [],
            rationale: null,
            pairs: reconcile(c, corpus.asOf).pairs.map((p) => ({
              leftClaimId: p.leftClaimId,
              rightClaimId: p.rightClaimId,
              relation: null,
            })),
            scopeError: null,
            temporalError: null,
            lineageError: null,
            unsupportedConclusion: null,
            correctAbstention: null,
          })),
      },
      true,
    );
    await this.audit.record({
      action: 'reconciliation.corpus_exported',
      targetType: 'ResearchCampaign',
      targetId: campaignId,
      administratorId: administrator.id,
      metadata: { corpusDigest: manifest.corpusDigest, cases: corpus.cases.length },
    });
    return { manifest, sampling: sampling.summary };
  }

  async run(directory: string) {
    const { corpus, digest } = await readReconciliationCorpus(directory);
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) throw new PreconditionError('Administrator required');
    const rows = await this.repository.loadClaims(corpus.campaignId, [
      ...new Set(corpus.cases.flatMap((c) => c.candidateIds)),
    ]);
    const retained = new Map(rows.map((r) => [r.id, projectClaim(r)]));
    for (const item of corpus.cases) {
      if (!item.candidateIds.includes(item.anchorCandidateId) || item.lineage.length > 0)
        throw new PreconditionError('Unreviewed external identity/lineage assertion');
      for (const proposition of item.propositions) {
        const original = retained.get(proposition.claimId);
        if (
          original === undefined ||
          original === null ||
          canonicalJson({ ...original, methodStatus: proposition.methodStatus }) !==
            canonicalJson(proposition)
        )
          throw new PreconditionError('Pinned Claim differs from retained Evidence');
      }
    }
    const started = performance.now();
    const results = corpus.cases.map((c) => reconcile(c, corpus.asOf));
    const processingMs = performance.now() - started;
    const created = await persistReconciliation(
      {
        campaignId: corpus.campaignId,
        administratorId: administrator.id,
        corpusDigest: digest,
        cases: corpus.cases,
        results,
      },
      {
        transaction: (work) => this.unitOfWork.run(work),
        store: (input, result) =>
          this.repository.store(corpus.campaignId, input, result, administrator.id),
        audit: (event) => this.audit.record(event),
      },
    );
    const report = observedReport(results);
    await writePrivate(directory, 'results.private.json', results);
    await writePrivate(directory, 'observed-report.json', report);
    const execution = {
      corpusDigest: digest,
      outputDigest: sha256Hex(canonicalJson(results)),
      created,
      unchanged: results.length - created,
      processingMs,
      externalCalls: 0,
      externalCost: 0,
      currency: null,
      storageBytes: Buffer.byteLength(canonicalJson(results)),
      note: 'Observed local rule time excludes corpus export, database writes and human review; no monetary infrastructure estimate.',
    };
    await writePrivate(directory, 'execution.json', execution);
    return { ...execution, report };
  }

  async score(directory: string, paths: string[], adjudicationPath?: string) {
    const { corpus, digest } = await readReconciliationCorpus(directory);
    const results = corpus.cases.map((c) => reconcile(c, corpus.asOf));
    const reviews = await Promise.all(
      paths.map(async (path) => reviewSchema.parse(JSON.parse(await readFile(path, 'utf8')))),
    );
    const adjudication =
      adjudicationPath === undefined
        ? undefined
        : adjudicationSchema.parse(JSON.parse(await readFile(adjudicationPath, 'utf8')));
    const report = scoreReconciliation(corpus, digest, results, reviews, adjudication);
    await writePrivate(directory, 'quality-report.json', report);
    return report;
  }

  async inspect(campaignId: string, candidateId: string) {
    if ((await this.queries.findCandidate(campaignId, candidateId)) === undefined)
      throw new NotFoundError('Candidate not found in campaign');
    const rows = await this.repository.list(campaignId, candidateId);
    return rows.map((row) => ({ ...row, assessedAt: row.assessedAt.toISOString() }));
  }
}

function observedReport(results: ReconciliationResult[]) {
  const profiles = results.flatMap((r) => r.profiles),
    pairs = results.flatMap((r) => r.pairs);
  const counts = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length]),
    );
  return {
    cases: results.length,
    profiles: profiles.length,
    pairs: pairs.length,
    candidateAttributeCells: new Set(profiles.map((p) => `${p.candidateId}:${p.attribute}`)).size,
    support: counts(profiles.map((p) => p.support)),
    corroboration: counts(profiles.map((p) => p.corroboration)),
    temporal: counts(profiles.map((p) => p.temporal)),
    freshness: counts(profiles.map((p) => p.freshness)),
    relations: counts(pairs.map((p) => p.relation)),
    lineage: counts(pairs.map((p) => p.lineage)),
    conditionalCrossCandidatePairs: pairs.filter((p) => p.identityConditional).length,
    inactiveMethodWarnings: profiles.filter((p) =>
      p.uncertainties.includes('inactive_method_retained'),
    ).length,
    byAttribute: Object.fromEntries(
      [...new Set(profiles.map((p) => p.attribute))].sort().map((attribute) => [
        attribute,
        {
          profiles: profiles.filter((p) => p.attribute === attribute).length,
          support: counts(profiles.filter((p) => p.attribute === attribute).map((p) => p.support)),
          pairs: counts(pairs.filter((p) => p.attribute === attribute).map((p) => p.relation)),
        },
      ]),
    ),
    independentlyConfirmedConclusions: null,
    independentReviewers: 0,
    verifiedOrPublished: 0,
    label:
      'Observed rule outputs, not semantic accuracy or independently confirmed property knowledge',
  };
}
