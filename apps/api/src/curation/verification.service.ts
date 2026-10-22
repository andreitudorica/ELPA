import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { z } from 'zod';

import { AuditRepository } from '../audit';
import { type AppClsStore, NotFoundError, PreconditionError } from '../common';
import { loadEnv } from '../config/env';
import { UnitOfWork } from '../database';
import {
  ClaimEvidenceReader,
  ROMANIAN_COUNTIES,
  UnionFind,
  canonicalJson,
  fieldPath,
  sha256Hex,
  type ClaimEvidenceRow,
} from '../research';
import { AnthropicEvidenceAssessor, type EvidenceAssessorModel } from './anthropic-assessor';
import type { VerificationDecisionView, VerificationPolicyView } from './dto/verification.dto';
import {
  VerificationRepository,
  type DecisionInsert,
  type DecisionRow,
} from './verification.repository';
import {
  persistMachineDecisions,
  persistOverride,
  OVERRIDE_OUTCOMES,
} from './verification-persistence';
import { appendCapture, readCaptures, readCorpus, writePrivate } from './verification-files';
import {
  ASSESSOR_PROMPT_SHA256,
  ASSESSOR_PROMPT_VERSION,
  buildRequest,
  requestSha256,
  validateCaptured,
} from './verification/assessor';
import {
  CORPUS_VERSION,
  FOLLOW_UP_VERSION,
  POLICY_VERSION,
  CATEGORY_IDS,
  IMPLEMENTED_METHODS,
  OUTCOMES,
  RECOMMENDATIONS,
  SEED,
  STRATEGIES,
  VALIDATOR_VERSION,
  adjudicationSchema,
  assessmentSchema,
  categorySchema,
  followUpSchema,
  validationSchema,
  corpusSchema,
  reviewSchema,
  scoringItemSchema,
  type CapturedAssessment,
  type CategoryId,
  type ClaimSnapshot,
  type Corpus,
  type Split,
  type Strategy,
  type Subject,
} from './verification/contracts';
import { decide } from './verification/decision';
import { observedSummary, scoreEvaluation, type ScoringItem } from './verification/evaluation';
import { followUp, followUpApplicable } from './verification/follow-up';
import { CATEGORIES, POLICY_TARGETS, policyDocument } from './verification/policy';
import { drawSample, type FrameItem } from './verification/sampling';
import { categoryOf, locatorFields, validate } from './verification/validator';

const COUNTIES: Readonly<Record<string, string>> = ROMANIAN_COUNTIES;
const MAX_COUNTERPARTS = 20;
const OSM_CONTEXT_PATHS = [
  ['lat'],
  ['lon'],
  ['tags', 'addr:county'],
  ['tags', 'is_in:county'],
  ['tags', 'is_in'],
];

/** Key-only partitions of earlier experiments; content never leaves private storage. */
const priorManifestSchema = z.looseObject({
  items: z
    .array(
      z.looseObject({
        sourceKey: z.string().optional(),
        sourceRecordKey: z.string().optional(),
        partition: z.string(),
      }),
    )
    .optional(),
  cases: z
    .array(z.looseObject({ candidateIds: z.array(z.string()), partition: z.string() }))
    .optional(),
});

function snapshot(row: ClaimEvidenceRow): ClaimSnapshot {
  return {
    claimId: row.claimId,
    candidateId: row.candidateId,
    evidenceId: row.evidenceId,
    target: row.target,
    value: row.value,
    locator: z.record(z.string(), z.json()).parse(JSON.parse(canonicalJson(row.locator))),
    method: row.method,
    methodCurrent: row.methodCurrent,
    evidenceLatest: row.evidenceLatest,
    grounding: row.grounding,
    observedAt: row.observedAt,
    extractedAt: row.extractedAt,
  };
}

function pathsFor(claim: ClaimSnapshot, sourceKey: string): string[][] {
  const paths = locatorFields(claim).map(fieldPath);
  return sourceKey === 'osm_geofabrik_romania' ? [...paths, ...OSM_CONTEXT_PATHS] : paths;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly reader: ClaimEvidenceReader,
    private readonly repository: VerificationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditRepository,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  private administratorId(): string {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) throw new PreconditionError('Administrator required');
    return administrator.id;
  }

  /** Draws and seals the evaluation corpus and a blind review template. */
  async exportCorpus(campaignId: string, directory: string, priorPaths: string[]) {
    const administratorId = this.administratorId();
    const [frame, edges] = await Promise.all([
      this.reader.frame(campaignId, POLICY_TARGETS),
      this.reader.sameProperty(campaignId),
    ]);
    if (frame.length === 0) throw new NotFoundError('No verification frame in campaign');

    const prior = new Map<string, 'development' | 'holdout'>();
    for (const path of priorPaths) {
      const manifest = priorManifestSchema.parse(JSON.parse(await readFile(path, 'utf8')));
      const partition = (value: string) =>
        value === 'holdout' || value === 'evaluation' ? 'holdout' : 'development';
      for (const item of manifest.items ?? [])
        if (item.sourceRecordKey !== undefined)
          prior.set(`record:${item.sourceRecordKey}`, partition(item.partition));
      for (const c of manifest.cases ?? [])
        for (const id of c.candidateIds) prior.set(`candidate:${id}`, partition(c.partition));
    }

    const identity = new Map(
      frame.map((r) => [r.candidateId, `${r.sourceKey}:${r.sourceRecordKey}`]),
    );
    const groups = new UnionFind();
    for (const edge of edges) {
      const left = identity.get(edge.left),
        right = identity.get(edge.right);
      if (left !== undefined && right !== undefined) groups.union(left, right);
    }
    const byContent = new Map<string, string>();
    for (const row of frame) {
      const own = `${row.sourceKey}:${row.sourceRecordKey}`;
      const other = byContent.get(row.evidenceSha256);
      if (other === undefined) byContent.set(row.evidenceSha256, own);
      else groups.union(own, other);
    }
    const county = new Map(frame.map((r) => [r.candidateId, r.countyCode]));
    const neighbours = new Map<string, string[]>();
    for (const edge of edges) {
      neighbours.set(edge.left, [...(neighbours.get(edge.left) ?? []), edge.right]);
      neighbours.set(edge.right, [...(neighbours.get(edge.right) ?? []), edge.left]);
    }
    const perTarget = new Map<string, number>();
    for (const row of frame) {
      const key = `${row.candidateId}:${row.target}`;
      perTarget.set(key, (perTarget.get(key) ?? 0) + 1);
    }

    const items: (FrameItem & { row: (typeof frame)[number] })[] = [];
    for (const row of frame) {
      const fields =
        row.locatorType === 'text_span'
          ? [(row.locatorFieldPath ?? []).join('.')]
          : (row.locatorFields ?? []);
      const category = categoryOf(
        {
          claimId: row.claimId,
          candidateId: row.candidateId,
          evidenceId: row.evidenceId,
          target: row.target,
          value: null,
          locator:
            row.locatorType === 'text_span'
              ? { type: row.locatorType, fieldPath: row.locatorFieldPath ?? [] }
              : { type: row.locatorType, fields },
          method: row.method,
          methodCurrent: row.methodCurrent,
          evidenceLatest: row.evidenceLatest,
          grounding: 'not_applicable',
          observedAt: new Date(0).toISOString(),
          extractedAt: new Date(0).toISOString(),
        },
        row.sourceKey,
      );
      if (category === null) continue;
      const others = (neighbours.get(row.candidateId) ?? []).map((id) => county.get(id) ?? null);
      const locality = (): string =>
        others.some((c) => c !== null && c !== row.countyCode)
          ? 'conditional_conflict'
          : others.some((c) => c !== null && c === row.countyCode)
            ? 'conditional_agreement'
            : 'single_record';
      const stratum: Record<CategoryId, () => string> = {
        register_locality: locality,
        osm_county: locality,
        register_classified_capacity: () =>
          row.method !== 'situr-accommodation-normalizer@1' ||
          (perTarget.get(`${row.candidateId}:${row.target}`) ?? 0) > 1
            ? 'reprocessed_copy'
            : others.length > 0
              ? 'has_counterpart'
              : 'single_record',
        explicit_text_facility: () =>
          row.methodCurrent && row.evidenceLatest ? 'current' : 'superseded',
        property_shape_count: () =>
          row.locatorType === 'text_span' ? 'text_span' : 'structured_tag',
        high_consequence: () =>
          row.locatorType === 'text_span' ? 'text_capacity' : 'structured_capacity',
      };
      items.push({
        key: row.claimId,
        category,
        stratum: stratum[category](),
        group: sha256Hex(groups.find(`${row.sourceKey}:${row.sourceRecordKey}`)),
        prior:
          prior.get(`candidate:${row.candidateId}`) ??
          prior.get(`record:${row.sourceRecordKey}`) ??
          null,
        row,
      });
    }
    const sample = drawSample(items);
    const selectedRows = new Map(items.map((i) => [i.key, i.row]));

    const anchorIds = [
      ...new Set(sample.items.map((i) => selectedRows.get(i.key)?.candidateId ?? '')),
    ];
    const counterpartEdges = await this.reader.counterparts(campaignId, anchorIds);
    const counterpartIds = [...new Set(counterpartEdges.flatMap((e) => [e.left, e.right]))].filter(
      (id) => !anchorIds.includes(id),
    );
    const candidateIds = [...anchorIds, ...counterpartIds];
    const [candidateRows, claimRows] = await Promise.all([
      this.reader.candidates(campaignId, candidateIds),
      this.reader.claims(campaignId, candidateIds, POLICY_TARGETS),
    ]);
    const candidates = new Map(candidateRows.map((c) => [c.id, c]));
    const claimsByCandidate = new Map<string, ClaimEvidenceRow[]>();
    for (const row of claimRows)
      claimsByCandidate.set(row.candidateId, [
        ...(claimsByCandidate.get(row.candidateId) ?? []),
        row,
      ]);
    const claimById = new Map(claimRows.map((c) => [c.claimId, c]));

    const subjects: {
      subject: Omit<Subject, 'evidence'>;
      split: Split;
      stratum: string;
      weight: number;
      group: string;
      priorHoldout: boolean;
    }[] = [];
    const requests = new Map<string, Set<string>>();
    const request = (claim: ClaimSnapshot, sourceKey: string) => {
      const set = requests.get(claim.evidenceId) ?? new Set<string>();
      for (const path of pathsFor(claim, sourceKey)) set.add(JSON.stringify(path));
      requests.set(claim.evidenceId, set);
    };
    for (const item of sample.items) {
      const row = claimById.get(item.key);
      const candidate = row === undefined ? undefined : candidates.get(row.candidateId);
      if (row === undefined || candidate === undefined)
        throw new PreconditionError('Frame changed during sampling; no replacement');
      const claim = snapshot(row);
      const siblings = (claimsByCandidate.get(row.candidateId) ?? [])
        .filter((c) => c.target === row.target && c.claimId !== row.claimId)
        .map(snapshot);
      const related = counterpartEdges
        .filter((e) => e.left === row.candidateId || e.right === row.candidateId)
        .sort((a, b) =>
          a.strength === b.strength ? a.id.localeCompare(b.id) : a.strength === 'likely' ? -1 : 1,
        );
      const counterparts = related.slice(0, MAX_COUNTERPARTS).flatMap((edge) => {
        const otherId = edge.left === row.candidateId ? edge.right : edge.left;
        const other = candidates.get(otherId);
        if (other === undefined) return [];
        const claims = (claimsByCandidate.get(otherId) ?? [])
          .filter((c) => c.target === row.target)
          .map(snapshot);
        for (const c of claims) request(c, other.sourceKey);
        return [
          {
            suggestionId: edge.id,
            strength: edge.strength === 'likely' ? ('likely' as const) : ('possible' as const),
            candidate: {
              id: other.id,
              sourceKey: other.sourceKey,
              sourceRecordKey: other.sourceRecordKey,
              displayName: other.displayName,
            },
            claims,
          },
        ];
      });
      request(claim, candidate.sourceKey);
      for (const s of siblings) request(s, candidate.sourceKey);
      const conditions = [
        item.stratum,
        ...(claim.methodCurrent ? [] : ['superseded_method']),
        ...(claim.evidenceLatest ? [] : ['superseded_evidence']),
        ...(siblings.length > 0 ? ['multiple_claims_same_target'] : []),
        ...(related.length > MAX_COUNTERPARTS ? ['counterparts_truncated'] : []),
        ...(item.prior === 'holdout' ? ['prior_holdout'] : []),
        ...(row.value !== null &&
        typeof row.value === 'object' &&
        !Array.isArray(row.value) &&
        row.value.settlementSource === 'nearest_place'
          ? ['inferred_settlement']
          : []),
      ];
      subjects.push({
        subject: {
          itemId: sha256Hex(`${CORPUS_VERSION}:${row.claimId}`),
          category: item.category,
          candidate: {
            id: candidate.id,
            sourceKey: candidate.sourceKey,
            sourceRecordKey: candidate.sourceRecordKey,
            displayName: candidate.displayName,
          },
          claim,
          siblings,
          counterparts,
          conditions: [...new Set(conditions)],
        },
        split: item.split,
        stratum: item.stratum,
        weight: item.weight,
        group: item.group,
        priorHoldout: item.prior === 'holdout',
      });
    }
    const evidence = await this.reader.evidence(
      campaignId,
      [...requests].map(([evidenceId, paths]) => ({
        evidenceId,
        paths: [...paths].map((p) => z.array(z.string()).parse(JSON.parse(p))),
      })),
    );
    const evidenceById = new Map(evidence.map((e) => [e.id, e]));
    const corpus: Corpus = corpusSchema.parse({
      version: CORPUS_VERSION,
      policyVersion: POLICY_VERSION,
      campaignId,
      asOf: new Date().toISOString(),
      seed: SEED,
      frameDigest: sha256Hex(
        canonicalJson({
          frame: items.map(({ row: _row, ...item }) => item),
          edges: [...edges].sort((a, b) => a.id.localeCompare(b.id)),
        }),
      ),
      items: subjects.map(({ subject, ...rest }) => {
        const ids = new Set([
          subject.claim.evidenceId,
          ...subject.siblings.map((s) => s.evidenceId),
          ...subject.counterparts.flatMap((c) => c.claims.map((x) => x.evidenceId)),
        ]);
        return {
          ...rest,
          subject: {
            ...subject,
            evidence: [...ids].flatMap((id) => {
              const e = evidenceById.get(id);
              return e === undefined ? [] : [e];
            }),
          },
        };
      }),
    });
    const digest = sha256Hex(canonicalJson(corpus));
    await writePrivate(directory, 'corpus.private.json', corpus, true);
    const manifest = {
      version: CORPUS_VERSION,
      policyVersion: POLICY_VERSION,
      campaignId,
      seed: SEED,
      corpusDigest: digest,
      frameDigest: corpus.frameDigest,
      frameSize: items.length,
      sampling: sample.summary,
      items: corpus.items.map((i) => ({
        itemId: i.subject.itemId,
        claimId: i.subject.claim.claimId,
        candidateId: i.subject.candidate.id,
        sourceKey: i.subject.candidate.sourceKey,
        sourceRecordKey: i.subject.candidate.sourceRecordKey,
        category: i.subject.category,
        stratum: i.stratum,
        split: i.split,
        weight: i.weight,
        group: i.group,
        priorHoldout: i.priorHoldout,
      })),
    };
    await writePrivate(directory, 'manifest.json', manifest, true);
    // Blind template: Evidence and proposition only, no system output or developer labels.
    await writePrivate(
      directory,
      'review-template.private.json',
      {
        corpusDigest: digest,
        reviewerId: null,
        reviewerKind: 'independent_human',
        independenceStatement: null,
        labels: corpus.items
          .filter((i) => i.split !== 'development')
          .map((i) => ({
            itemId: i.subject.itemId,
            split: i.split,
            category: i.subject.category,
            proposition:
              i.subject.category === null ? null : CATEGORIES[i.subject.category].proposition,
            claimValue: i.subject.claim.value,
            property: i.subject.candidate,
            evidence: i.subject.evidence.map((e) => ({
              id: e.id,
              source: e.sourceKey,
              record: e.sourceRecordKey,
              version: e.artifact.datasetVersion,
              fields: e.fields.filter((f) => f.withheld === 'none'),
            })),
            label: null,
            evidenceInspected: [],
            rationale: null,
            seconds: null,
          })),
      },
      true,
    );
    await this.audit.record({
      action: 'verification.corpus_exported',
      targetType: 'ResearchCampaign',
      targetId: campaignId,
      administratorId,
      metadata: { corpusDigest: digest, items: corpus.items.length, policyVersion: POLICY_VERSION },
    });
    return { corpusDigest: digest, items: corpus.items.length, sampling: sample.summary };
  }

  /** Captures model assessments for one split under a cumulative hard budget. */
  async assess(
    directory: string,
    options: { split: Split; budgetUsd: number; concurrency: number; limit?: number },
    model?: EvidenceAssessorModel,
  ) {
    const administratorId = this.administratorId();
    const { corpus, digest } = await readCorpus(directory);
    const captures = await readCaptures(directory);
    const env = loadEnv();
    if (model === undefined && env.ANTHROPIC_API_KEY === undefined)
      throw new PreconditionError(
        'Set ANTHROPIC_API_KEY in apps/api/.env.local to run the capped model assessment',
      );
    const assessor =
      model ??
      new AnthropicEvidenceAssessor(
        new Anthropic({
          apiKey: env.ANTHROPIC_API_KEY,
          ...(env.ANTHROPIC_WORKSPACE_ID === undefined
            ? {}
            : { defaultHeaders: { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } }),
        }),
      );
    const done = new Set(captures.filter((c) => c.error === null).map((c) => c.requestSha256));
    let spent = captures.reduce((sum, c) => sum + (c.costUsd ?? 0), 0);
    const pending = corpus.items
      .filter((i) => i.split === options.split)
      .flatMap((item) => {
        const validation = validate(item.subject, { asOf: corpus.asOf, counties: COUNTIES });
        const request = buildRequest(item.subject, validation);
        return request === null || done.has(requestSha256(request)) ? [] : [request];
      })
      .slice(0, options.limit);
    let reserved = 0,
      calls = 0,
      failures = 0,
      stoppedForBudget = false,
      authenticationFailed = false;
    const queue = [...pending];
    const worker = async () => {
      for (;;) {
        const next = queue.shift();
        if (next === undefined || authenticationFailed) return;
        const worst = assessor.maxCostUsd(next);
        if (spent + reserved + worst > options.budgetUsd) {
          stoppedForBudget = true;
          return;
        }
        reserved += worst;
        const capture = await assessor.assess(next);
        reserved -= worst;
        spent += capture.costUsd ?? 0;
        calls++;
        if (capture.error !== null) failures++;
        if (capture.error?.status === 401) authenticationFailed = true;
        await appendCapture(directory, capture);
      }
    };
    const started = performance.now();
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
    const summary = {
      corpusDigest: digest,
      split: options.split,
      provider: assessor.provider,
      model: assessor.model,
      promptVersion: ASSESSOR_PROMPT_VERSION,
      promptSha256: ASSESSOR_PROMPT_SHA256,
      pending: pending.length,
      calls,
      failures,
      cumulativeCostUsd: Math.round(spent * 1e6) / 1e6,
      budgetUsd: options.budgetUsd,
      stoppedForBudget,
      authenticationFailed,
      wallMs: Math.round(performance.now() - started),
    };
    await this.audit.record({
      action: 'verification.assessments_captured',
      targetType: 'ResearchCampaign',
      targetId: corpus.campaignId,
      administratorId,
      metadata: summary,
    });
    return summary;
  }

  /** Validates, assesses (from captures), follows up and decides; persists strategy C. */
  async run(directory: string) {
    const administratorId = this.administratorId();
    const { corpus, digest } = await readCorpus(directory);
    const captures = new Map<string, CapturedAssessment>();
    for (const capture of await readCaptures(directory))
      if (capture.error === null || !captures.has(capture.requestSha256))
        captures.set(capture.requestSha256, capture);

    const pinned = await this.reader.claims(
      corpus.campaignId,
      [...new Set(corpus.items.map((i) => i.subject.claim.candidateId))],
      POLICY_TARGETS,
    );
    const current = new Map(pinned.map((c) => [c.claimId, c]));
    for (const item of corpus.items) {
      const now = current.get(item.subject.claim.claimId);
      if (now === undefined || canonicalJson(snapshot(now)) !== canonicalJson(item.subject.claim))
        throw new PreconditionError('Pinned Claim differs from retained Research data');
    }

    const eligibility = new Map(
      (await this.repository.activeEligibility(POLICY_VERSION)).map((e) => [
        e.category,
        { id: e.id, threshold: e.threshold },
      ]),
    );
    const started = performance.now();
    const results = corpus.items.map((item) => {
      const subject = item.subject;
      const validation = validate(subject, { asOf: corpus.asOf, counties: COUNTIES });
      const request = buildRequest(subject, validation);
      const assessment = validateCaptured(
        request === null ? undefined : captures.get(requestSha256(request)),
        request,
      );
      const research = followUpApplicable(subject, validation)
        ? followUp(subject, validation, COUNTIES)
        : null;
      const decideWith = (strategy: Strategy) =>
        decide({
          subject,
          validation,
          assessment,
          followUp: research,
          strategy,
          eligibility:
            subject.category === null ? null : (eligibility.get(subject.category) ?? null),
        });
      const decisions = { A: decideWith('A'), B: decideWith('B'), C: decideWith('C') };
      return { item, validation, assessment, followUp: research, decisions };
    });
    const processingMs = performance.now() - started;

    const inserts: DecisionInsert[] = results.map(
      ({ item, validation, assessment, followUp: research, decisions }) => {
        const decision = decisions.C;
        const subject = item.subject;
        const basis = {
          validatorVersion: VALIDATOR_VERSION,
          followUpVersion: FOLLOW_UP_VERSION,
          corpusDigest: digest,
          itemId: subject.itemId,
          proposition: validation.proposition,
          validation,
          assessment: decision.assessmentUsed ? assessment : null,
          followUp: research,
          reasons: decision.reasons,
          conditions: subject.conditions,
        };
        return {
          researchCampaignId: corpus.campaignId,
          candidateId: subject.candidate.id,
          claimId: subject.claim.claimId,
          category: subject.category,
          method: 'machine_policy',
          outcome: decision.outcome,
          recommendation: decision.recommendation,
          policyVersion: POLICY_VERSION,
          strategy: 'C',
          eligibilityId: decision.eligibilityId,
          supersedesDecisionId: null,
          evidenceIds: [...new Set(subject.evidence.map((e) => e.id))].sort(),
          inputClaimIds: [
            ...new Set([
              subject.claim.claimId,
              ...subject.siblings.map((s) => s.claimId),
              ...subject.counterparts.flatMap((c) => c.claims.map((x) => x.claimId)),
            ]),
          ].sort(),
          basis,
          evidenceScore: decision.evidenceScore,
          overrideReason: null,
          inputDigest: sha256Hex(canonicalJson({ subject, basis, decision })),
          asOf: new Date(corpus.asOf),
          decidedAt: new Date(),
          decidedByAdministratorId: administratorId,
        };
      },
    );
    const created = await persistMachineDecisions(
      { campaignId: corpus.campaignId, administratorId, corpusDigest: digest, decisions: inserts },
      {
        transaction: (work) => this.unitOfWork.run(work),
        insert: (d) => this.repository.insertDecision(d),
        eligibility: async (ids) => this.repository.eligibilityByIds(ids),
        audit: (event) => this.audit.record(event),
      },
    );
    const scoring: ScoringItem[] = results.map((r) => ({
      itemId: r.item.subject.itemId,
      split: r.item.split,
      category: r.item.subject.category,
      sourceKey: r.item.subject.candidate.sourceKey,
      conditions: r.item.subject.conditions,
      decisions: r.decisions,
      assessment: r.assessment,
      followUp: r.followUp,
    }));
    await writePrivate(directory, 'scoring-items.private.json', {
      corpusDigest: digest,
      items: scoring,
    });
    const observed = observedSummary(scoring);
    const execution = {
      corpusDigest: digest,
      outputDigest: sha256Hex(canonicalJson(scoring)),
      decisionsCreated: created,
      decisionsUnchanged: inserts.length - created,
      processingMs: Math.round(processingMs),
      networkCalls: 0,
      note: 'Local policy time; model calls are captured separately by verification-assess.',
    };
    await writePrivate(directory, 'observed-report.json', observed);
    await writePrivate(directory, 'execution.json', execution);
    return { ...execution, observed };
  }

  /** Scores strategies against independent labels and records the aggregate evaluation. */
  async score(directory: string, labelPaths: string[], adjudicationPath?: string) {
    const administratorId = this.administratorId();
    const { corpus, digest } = await readCorpus(directory);
    const stored = z
      .object({ corpusDigest: z.string(), items: z.array(scoringItemSchema) })
      .parse(JSON.parse(await readFile(join(directory, 'scoring-items.private.json'), 'utf8')));
    if (stored.corpusDigest !== digest)
      throw new PreconditionError('Run output belongs to another corpus');
    const reviews = await Promise.all(
      labelPaths.map(async (p) => reviewSchema.parse(JSON.parse(await readFile(p, 'utf8')))),
    );
    const adjudication =
      adjudicationPath === undefined
        ? undefined
        : adjudicationSchema.parse(JSON.parse(await readFile(adjudicationPath, 'utf8')));
    const evaluation = scoreEvaluation({
      corpusDigest: digest,
      items: stored.items,
      reviews,
      adjudication,
    });
    const report = {
      policyVersion: POLICY_VERSION,
      corpusVersion: corpus.version,
      corpusDigest: digest,
      assessor: { promptVersion: ASSESSOR_PROMPT_VERSION, promptSha256: ASSESSOR_PROMPT_SHA256 },
      ...evaluation,
      observed: observedSummary(stored.items),
    };
    await writePrivate(directory, 'quality-report.json', report);
    const evaluationId = await this.repository.insertEvaluation({
      policyVersion: POLICY_VERSION,
      corpusDigest: digest,
      reportDigest: sha256Hex(canonicalJson(report)),
      report,
      evaluatedByAdministratorId: administratorId,
      evaluatedAt: new Date(),
    });
    await this.audit.record({
      action: 'verification.evaluated',
      targetType: 'VerificationEvaluation',
      targetId: evaluationId,
      administratorId,
      metadata: {
        status: evaluation.status,
        reviewers: evaluation.labels.reviewers,
        passedCategories: Object.entries(evaluation.gates)
          .filter(([, g]) => g.passed)
          .map(([c]) => c),
      },
    });
    return { evaluationId, ...report };
  }

  /** Records an Administrator's approval of one category whose gate passed. */
  async approve(evaluationId: string, category: CategoryId) {
    const administratorId = this.administratorId();
    const evaluation = await this.repository.findEvaluation(evaluationId);
    if (evaluation === undefined) throw new NotFoundError('Evaluation not found');
    const report = z
      .object({
        policyVersion: z.literal(POLICY_VERSION),
        labels: z.object({ reviewers: z.number() }).loose(),
        gates: z.record(
          z.string(),
          z.object({
            passed: z.boolean(),
            threshold: z.number().nullable(),
            reasons: z.array(z.string()),
          }),
        ),
        strategies: z
          .object({
            C: z.record(
              z.string(),
              z
                .object({
                  holdout: z
                    .object({
                      autoApprovals: z.number(),
                      falseApprovalUpper: z.number().nullable(),
                    })
                    .loose(),
                })
                .loose(),
            ),
          })
          .loose(),
      })
      .loose()
      .parse(evaluation.report);
    const gate = report.gates[category];
    const holdout = report.strategies.C[category]?.holdout;
    if (gate?.passed !== true || gate.threshold === null || holdout?.falseApprovalUpper == null)
      throw new PreconditionError(`Category ${category} has not passed its predeclared gate`);
    const id = await this.unitOfWork.run(async () => {
      const created = await this.repository.insertEligibility({
        policyVersion: POLICY_VERSION,
        category,
        evaluationId,
        threshold: gate.threshold ?? 0,
        acceptedHoldout: holdout.autoApprovals,
        falseApprovalUpper: holdout.falseApprovalUpper ?? 1,
        reviewers: report.labels.reviewers,
        approvedByAdministratorId: administratorId,
        approvedAt: new Date(),
      });
      await this.audit.record({
        action: 'verification.eligibility_approved',
        targetType: 'VerificationEvaluation',
        targetId: evaluationId,
        administratorId,
        metadata: { category, eligibilityId: created, threshold: gate.threshold },
      });
      return created;
    });
    return { eligibilityId: id, category };
  }

  async policy(): Promise<VerificationPolicyView> {
    const [eligibility, evaluation] = await Promise.all([
      this.repository.activeEligibility(POLICY_VERSION),
      this.repository.latestEvaluation(POLICY_VERSION),
    ]);
    const report = evaluation === undefined ? null : storedReportSchema.parse(evaluation.report);
    const document = policyDocument();
    return {
      version: document.version,
      categories: document.categories.map((category) => {
        const approved = eligibility.find((e) => e.category === category.id);
        return {
          ...category,
          eligibility:
            approved === undefined
              ? null
              : {
                  id: approved.id,
                  threshold: approved.threshold,
                  approvedAt: approved.approvedAt.toISOString(),
                },
        };
      }),
      evaluation:
        evaluation === undefined || report === null
          ? null
          : {
              id: evaluation.id,
              evaluatedAt: evaluation.evaluatedAt.toISOString(),
              status: report.status,
              reviewers: report.labels.reviewers,
              labeledItems: report.labels.labeledItems,
              gates: byCategory((c) => ({
                passed: report.gates[c].passed,
                reasons: report.gates[c].reasons,
              })),
              holdout: byCategory((c) => {
                const h = report.strategies.C[c].holdout;
                return {
                  autoApprovals: h.autoApprovals,
                  falseApprovals: h.falseApprovals,
                  labeled: h.labeled,
                  precision: h.precision.value,
                  falseApprovalUpper: h.falseApprovalUpper,
                };
              }),
              strategies: {
                A: strategyCost(report, 'A'),
                B: strategyCost(report, 'B'),
                C: strategyCost(report, 'C'),
              },
            },
    };
  }

  async inspectCandidate(
    campaignId: string,
    candidateId: string,
  ): Promise<VerificationDecisionView[]> {
    const [rows, claims] = await Promise.all([
      this.repository.listForCandidate(campaignId, candidateId),
      this.reader.claims(campaignId, [candidateId], POLICY_TARGETS),
    ]);
    const claimById = new Map(claims.map((c) => [c.claimId, c]));
    const supersededBy = new Map(
      rows.flatMap((r) =>
        r.supersedesDecisionId === null ? [] : [[r.supersedesDecisionId, r.id] as const],
      ),
    );
    return rows.map((row) =>
      present(row, claimById.get(row.claimId), supersededBy.get(row.id) ?? null),
    );
  }

  async override(
    decisionId: string,
    outcome: (typeof OVERRIDE_OUTCOMES)[number],
    reason: string,
  ): Promise<VerificationDecisionView[]> {
    const administratorId = this.administratorId();
    const previous = await this.repository.findDecision(decisionId);
    if (previous === undefined) throw new NotFoundError('Verification Decision not found');
    const now = new Date();
    await persistOverride(
      {
        supersededId: previous.id,
        administratorId,
        decision: {
          researchCampaignId: previous.researchCampaignId,
          candidateId: previous.candidateId,
          claimId: previous.claimId,
          category: previous.category,
          method: 'administrator',
          outcome,
          recommendation: null,
          policyVersion: previous.policyVersion,
          strategy: null,
          eligibilityId: null,
          supersedesDecisionId: previous.id,
          evidenceIds: previous.evidenceIds,
          inputClaimIds: previous.inputClaimIds,
          basis: {
            overrides: previous.id,
            previousMethod: previous.method,
            previousOutcome: previous.outcome,
          },
          evidenceScore: null,
          overrideReason: reason.trim(),
          inputDigest: sha256Hex(
            canonicalJson({ supersedes: previous.id, outcome, reason: reason.trim() }),
          ),
          asOf: now,
          decidedAt: now,
          decidedByAdministratorId: administratorId,
        },
      },
      {
        transaction: (work) => this.unitOfWork.run(work),
        insert: (d) => this.repository.insertDecision(d),
        superseded: (id) => this.repository.isSuperseded(id),
        audit: (event) => this.audit.record(event),
      },
    );
    return this.inspectCandidate(previous.researchCampaignId, previous.candidateId);
  }
}

const machineBasisSchema = z
  .object({
    proposition: validationSchema.shape.proposition,
    validation: validationSchema,
    assessment: assessmentSchema.nullable(),
    followUp: followUpSchema.nullable(),
    reasons: z.array(z.string()),
    conditions: z.array(z.string()),
  })
  .loose();

/** Studio projection of one decision; publication is always reported as blocked. */
function present(
  row: DecisionRow,
  claim: ClaimEvidenceRow | undefined,
  supersededBy: string | null,
): VerificationDecisionView {
  // Administrator overrides carry only a reference to the decision they supersede.
  const basis = machineBasisSchema.safeParse(row.basis);
  const machine = basis.success ? basis.data : null;
  const parsedCategory = categorySchema.safeParse(row.category);
  const category = parsedCategory.success ? CATEGORIES[parsedCategory.data] : null;
  const method = z.enum(IMPLEMENTED_METHODS).parse(row.method);
  return {
    id: row.id,
    claimId: row.claimId,
    target: claim?.target ?? null,
    claimValue: claim?.value ?? null,
    claimSuperseded: claim === undefined || !claim.methodCurrent || !claim.evidenceLatest,
    category: parsedCategory.success ? parsedCategory.data : null,
    risk: category?.risk ?? null,
    method,
    outcome: z.enum(OUTCOMES).parse(row.outcome),
    recommendation: z.enum(RECOMMENDATIONS).nullable().parse(row.recommendation),
    policyVersion: row.policyVersion,
    strategy: z.enum(STRATEGIES).nullable().parse(row.strategy),
    evidenceScore: row.evidenceScore,
    reasons: machine?.reasons ?? [],
    conditions: machine?.conditions ?? [],
    proposition: machine?.proposition ?? null,
    validation: machine?.validation ?? null,
    assessment: machine?.assessment ?? null,
    followUp: machine?.followUp ?? null,
    eligibilityId: row.eligibilityId,
    overrideReason: row.overrideReason,
    supersedesDecisionId: row.supersedesDecisionId,
    supersededBy,
    decidedAt: row.decidedAt.toISOString(),
    asOf: row.asOf.toISOString(),
    publication: {
      status: 'blocked',
      reasons: [
        'separate_publication_decision_required',
        ...(machine?.validation.publicationConstraints ?? []),
        ...(category !== null && !category.publicationMethods.includes(method)
          ? ['method_not_accepted_for_category']
          : []),
      ],
    },
  };
}

const storedReportSchema = z
  .object({
    status: z.string(),
    labels: z.object({ reviewers: z.number().int(), labeledItems: z.number().int() }).loose(),
    gates: z.record(
      z.enum(CATEGORY_IDS),
      z.object({ passed: z.boolean(), reasons: z.array(z.string()) }).loose(),
    ),
    strategies: z
      .object({
        C: z.record(
          z.enum(CATEGORY_IDS),
          z
            .object({
              holdout: z
                .object({
                  autoApprovals: z.number().int(),
                  falseApprovals: z.number().int(),
                  labeled: z.number().int(),
                  precision: z.object({ value: z.number().nullable() }).loose(),
                  falseApprovalUpper: z.number().nullable(),
                })
                .loose(),
            })
            .loose(),
        ),
      })
      .loose(),
    observed: z
      .object({
        strategies: z.record(
          z.enum(STRATEGIES),
          z
            .object({
              recommendations: z.record(z.string(), z.number().int()),
              assessmentCalls: z.number().int(),
              assessmentCostUsd: z.number(),
              assessmentLatencyMs: z.number(),
            })
            .loose(),
        ),
      })
      .loose(),
  })
  .loose();

function byCategory<V>(value: (category: CategoryId) => V): Record<CategoryId, V> {
  return {
    register_locality: value('register_locality'),
    osm_county: value('osm_county'),
    register_classified_capacity: value('register_classified_capacity'),
    explicit_text_facility: value('explicit_text_facility'),
    property_shape_count: value('property_shape_count'),
    high_consequence: value('high_consequence'),
  };
}

function strategyCost(report: z.infer<typeof storedReportSchema>, strategy: Strategy) {
  const observed = report.observed.strategies[strategy];
  return {
    recommendations: observed.recommendations,
    assessmentCalls: observed.assessmentCalls,
    assessmentCostUsd: observed.assessmentCostUsd,
    assessmentLatencyMs: observed.assessmentLatencyMs,
  };
}
