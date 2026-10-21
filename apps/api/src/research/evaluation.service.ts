import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { NotFoundError, PreconditionError } from '../common';
import { CURRENT_EXTRACTION_METHODS } from './acquisition/sources';
import type { JsonValue, SourceKey } from './acquisition/source-record';
import { AcquisitionQueryRepository } from './acquisition-query.repository';
import { CandidateClaimsRepository } from './candidate-claims.repository';
import { parseCsv, toCsv } from './evaluation/csv';
import { PARTITION_VERSION } from './evaluation/partition';
import {
  drawEvaluationSample,
  type HardCasePair,
  QUOTAS,
  SAMPLE_SEED,
  SAMPLE_VERSION,
  type SampleCandidate,
  type SampleItem,
} from './evaluation/sampling';
import { DECISIONS, type LabelRow, scoreEvaluation } from './evaluation/scoring';
import { MATCHER_VERSION, prepareCandidate } from './matching/duplicate-matcher';
import { MATCH_CLAIM_TARGETS, matchFeaturesFromClaims } from './matching/match-features';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { compareIncrementalSource, PRIORITY_TARGETS } from './next-source/comparison';

const REVIEW_COLUMNS = [
  'item_id',
  'task',
  'question',
  'left_source',
  'left_record_key',
  'left_link',
  'left_name',
  'left_settlement',
  'left_county',
  'left_details',
  'right_source',
  'right_record_key',
  'right_link',
  'right_name',
  'right_settlement',
  'right_county',
  'right_details',
  'decision',
  'allowed_decisions',
  'counterpart_osm_ids',
  'evidence_urls',
  'ambiguity',
  'notes',
  'reviewer_id',
  'reviewed_at',
] as const;

const QUESTIONS = {
  record_match:
    'Is there an OpenStreetMap object for the same real-world property as this register record? If yes, list its OSM ids.',
  pair_match: 'Do these two records describe the same real-world property?',
  eligibility:
    'Under population rubric v1, is this property rentable as a whole for a group stay or private event?',
} as const;

function text(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Exports the blind review sample and scores reviewer labels. Exports and
 * labels stay in an ignored local directory because they contain register
 * data whose redistribution terms are unconfirmed; only the protocol,
 * sample manifest, and aggregate scores are committed.
 */
@Injectable()
export class EvaluationService {
  constructor(
    private readonly campaigns: ResearchCampaignRepository,
    private readonly candidateClaims: CandidateClaimsRepository,
    private readonly queries: AcquisitionQueryRepository,
  ) {}

  async exportIncrementalComparison(researchCampaignId: string, outDir: string) {
    const campaign = await this.campaigns.findById(researchCampaignId);
    if (campaign === undefined)
      throw new NotFoundError(`Research Campaign ${researchCampaignId} does not exist`);
    const [claimSets, members, edges, runs] = await Promise.all([
      this.candidateClaims.loadLatestClaims(campaign.id, [
        ...MATCH_CLAIM_TARGETS,
        ...PRIORITY_TARGETS,
      ]),
      this.queries.candidatesForClustering(campaign.id),
      this.queries.suggestionEdges(campaign.id, MATCHER_VERSION),
      this.queries.listRuns(campaign.id),
    ]);
    const result = compareIncrementalSource(claimSets, members, edges);
    if (result.predictions.length === 0)
      throw new PreconditionError('Import the Overture sample before comparison');
    const reviewIds = [
      ...new Set(result.predictions.flatMap((row) => [row.candidateId, ...row.counterpartIds])),
    ];
    const retainedEvidence = await this.candidateClaims.loadLatestEvidenceForCandidates(reviewIds);
    const link = (id: string) =>
      `http://localhost:5273/studio/research-campaigns/${campaign.id}/candidates/${id}`;
    const holdout = result.predictions.filter((row) => row.partition === 'evaluation');
    await mkdir(outDir, { recursive: true });
    const latestRuns = [...new Set(runs.map((run) => run.sourceKey))].flatMap((sourceKey) => {
      const run = runs.find(
        (entry) =>
          entry.sourceKey === sourceKey &&
          ['succeeded', 'completed_with_rejections'].includes(entry.status),
      );
      return run === undefined ? [] : [run];
    });
    const recordsRead = (sourceRuns: typeof latestRuns) =>
      sourceRuns.reduce(
        (sum, run) => sum + (typeof run.stats.recordsRead === 'number' ? run.stats.recordsRead : 0),
        0,
      );
    const report = {
      ...result.report,
      before: {
        ...result.report.before,
        sourceRecordsRead: recordsRead(
          latestRuns.filter((run) => run.sourceKey !== 'overture_places'),
        ),
      },
      after: { ...result.report.after, sourceRecordsRead: recordsRead(latestRuns) },
      campaignId: campaign.id,
      matcherVersion: MATCHER_VERSION,
      artifactChecksums: [...new Set(runs.map((run) => run.artifact.sha256))].sort(),
      acquisitionRuns: runs.map((run) => ({
        id: run.id,
        sourceKey: run.sourceKey,
        parserVersion: run.parserVersion,
        normalizerVersion: run.normalizerVersion,
        startedAt: run.startedAt.toISOString(),
        status: run.status,
        stats: run.stats,
      })),
    };
    await writeFile(
      join(outDir, 'incremental-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    await writeFile(
      join(outDir, 'prediction-key.private.json'),
      `${JSON.stringify(result.predictions, null, 2)}\n`,
    );
    await writeFile(
      join(outDir, 'evidence.private.json'),
      `${JSON.stringify(
        {
          retainedEvidence,
          extractedClaims: claimSets.filter((row) => reviewIds.includes(row.id)),
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(outDir, 'holdout-review.csv'),
      toCsv(
        [
          'source_record_key',
          'candidate_link',
          'baseline_search_link',
          'baseline_candidate_links',
          'evidence_file',
          'discovery_decision',
          'pair_decision',
          'counterpart_source_keys',
          'attribute_target',
          'attribute_decision',
          'evidence_locator',
          'evidence_urls',
          'ambiguity',
          'notes',
          'reviewer_id',
          'reviewer_type',
          'reviewed_at',
        ],
        holdout.map((row) => ({
          source_record_key: row.sourceRecordKey,
          candidate_link: link(row.candidateId),
          baseline_search_link: `http://localhost:5273/studio/research-campaigns/${campaign.id}?tab=candidates`,
          baseline_candidate_links: row.counterpartIds.map(link).join(' | '),
          evidence_file: 'evidence.private.json',
        })),
      ),
    );
    await writeFile(
      join(outDir, 'review-manifest.json'),
      `${JSON.stringify(
        {
          experimentVersion: report.experimentVersion,
          matcherVersion: MATCHER_VERSION,
          items: holdout.map((row) => ({
            sourceRecordKey: row.sourceRecordKey,
            partition: row.partition,
          })),
          reviewStatus: 'not_started',
          labels: 0,
        },
        null,
        2,
      )}\n`,
    );
    return {
      outDir,
      report: 'incremental-report.json',
      holdoutRecords: holdout.length,
      reviewStatus: 'not_started',
    };
  }

  async exportSample(researchCampaignId: string, outDir: string) {
    const campaign = await this.campaigns.findById(researchCampaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`Research Campaign ${researchCampaignId} does not exist`);
    }

    const [claimSets, members, edges, runs] = await Promise.all([
      this.candidateClaims.loadLatestClaims(campaign.id, [
        ...MATCH_CLAIM_TARGETS,
        'offer.population_screening',
      ]),
      this.queries.candidatesForClustering(campaign.id),
      this.queries.suggestionEdges(campaign.id, MATCHER_VERSION),
      this.queries.listRuns(campaign.id),
    ]);
    if (edges.length === 0) {
      throw new PreconditionError(`Run duplicate detection (${MATCHER_VERSION}) before sampling`);
    }

    const summaries = new Map(members.map((member) => [member.id, member]));
    const sampleCandidates: SampleCandidate[] = claimSets.flatMap((set) => {
      const member = summaries.get(set.id);
      if (member === undefined) return [];
      const locality = objectValue(set.claims['offer.primary_locality']);
      const address = objectValue(set.claims['offer.address']);
      const registerType = text(objectValue(set.claims['offer.registry_structure_type']).key);
      const tourism = text(objectValue(set.claims['offer.osm_tourism_type']).tourism);
      const sleeps = set.claims['offer.sleeps_persons'] ?? set.claims['offer.capacity_persons'];
      return [
        {
          id: set.id,
          sourceKey: set.sourceKey,
          sourceRecordKey: set.sourceRecordKey,
          sourceRecordUrl:
            set.sourceKey === 'osm_geofabrik_romania'
              ? `https://www.openstreetmap.org/${set.sourceRecordKey}`
              : null,
          displayName: text(set.claims['offer.name']) ?? set.sourceRecordKey,
          countyCode: set.countyCode,
          settlementName: text(locality.settlementName),
          screeningClass: member.screeningClass,
          structureType:
            registerType !== null
              ? `situr:${registerType}`
              : tourism !== null
                ? `osm:${tourism}`
                : null,
          urbanity: text(locality.urbanity) ?? 'unknown',
          sleepsPersons: typeof sleeps === 'number' ? sleeps : null,
          address: text(address.raw),
        },
      ];
    });

    const hardCases = this.hardCases(claimSets, edges);
    const { items, strataSizes } = drawEvaluationSample(
      sampleCandidates,
      edges.map((edge) => ({
        id: edge.id,
        leftId: edge.left,
        rightId: edge.right,
        relation: edge.relation,
        strength: edge.strength,
        rule: edge.rule,
      })),
      hardCases,
    );

    const manifest = {
      sampleVersion: SAMPLE_VERSION,
      seed: SAMPLE_SEED,
      partitionVersion: PARTITION_VERSION,
      matcherVersion: MATCHER_VERSION,
      extractionMethods: [...CURRENT_EXTRACTION_METHODS],
      quotas: QUOTAS,
      researchCampaignId: campaign.id,
      artifacts: [...new Map(runs.map((run) => [run.artifact.sha256, run.artifact])).values()].map(
        (artifact) => ({ sha256: artifact.sha256, datasetVersion: artifact.datasetVersion }),
      ),
      itemsByTask: {
        record_match: items.filter((item) => item.task === 'record_match').length,
        pair_match: items.filter((item) => item.task === 'pair_match').length,
        eligibility: items.filter((item) => item.task === 'eligibility').length,
      },
      strata: Object.fromEntries(
        Object.entries(strataSizes)
          .sort(([left], [right]) => (left < right ? -1 : 1))
          .map(([stratum, population]) => [
            stratum,
            { population, sampled: items.filter((item) => item.stratum === stratum).length },
          ]),
      ),
      items: items.map((item) => ({
        itemId: item.itemId,
        task: item.task,
        stratum: item.stratum,
        left: `${item.left.sourceKey}:${item.left.sourceRecordKey}`,
        right: item.right === null ? null : `${item.right.sourceKey}:${item.right.sourceRecordKey}`,
      })),
    };

    await mkdir(outDir, { recursive: true });
    const details = (candidate: SampleCandidate | null) =>
      candidate === null
        ? ''
        : [
            candidate.structureType,
            candidate.sleepsPersons === null ? null : `${String(candidate.sleepsPersons)} locuri`,
            candidate.address,
          ]
            .filter((part) => part !== null)
            .join(' · ');
    const side = (prefix: 'left' | 'right', candidate: SampleCandidate | null) => ({
      [`${prefix}_source`]: candidate?.sourceKey ?? '',
      [`${prefix}_record_key`]: candidate?.sourceRecordKey ?? '',
      [`${prefix}_link`]:
        candidate?.sourceRecordUrl ??
        (candidate === null ? '' : `data-studio:candidate/${candidate.id}`),
      [`${prefix}_name`]: candidate?.displayName ?? '',
      [`${prefix}_settlement`]: candidate?.settlementName ?? '',
      [`${prefix}_county`]: candidate?.countyCode ?? '',
      [`${prefix}_details`]: details(candidate),
    });
    const sheet = toCsv(
      REVIEW_COLUMNS,
      items.map((item) => ({
        item_id: item.itemId,
        task: item.task,
        question: QUESTIONS[item.task],
        ...side('left', item.left),
        ...side('right', item.right),
        allowed_decisions: DECISIONS[item.task].join(' | '),
      })),
    );
    await writeFile(join(outDir, 'review-sheet.csv'), sheet);
    await writeFile(join(outDir, 'sample-key.json'), `${JSON.stringify(items, null, 2)}\n`);
    await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return { outDir, ...manifest, items: undefined };
  }

  async score(researchCampaignId: string, sampleDir: string, labelPaths: string[]) {
    const campaign = await this.campaigns.findById(researchCampaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`Research Campaign ${researchCampaignId} does not exist`);
    }
    const items = JSON.parse(
      await readFile(join(sampleDir, 'sample-key.json'), 'utf8'),
    ) as SampleItem[];
    const labels: LabelRow[] = [];
    for (const path of labelPaths) {
      for (const row of parseCsv(await readFile(path, 'utf8'))) {
        labels.push({
          item_id: row.item_id ?? '',
          reviewer_id: (row.reviewer_id ?? '').trim(),
          decision: (row.decision ?? '').trim(),
          counterpart_osm_ids: row.counterpart_osm_ids ?? '',
        });
      }
    }
    if (labels.some((label) => label.decision !== '' && label.reviewer_id === '')) {
      throw new PreconditionError('Every labelled row needs a reviewer_id');
    }
    const score = {
      matcherVersion: MATCHER_VERSION,
      scoredAt: new Date().toISOString(),
      ...scoreEvaluation(items, labels),
    };
    await writeFile(join(sampleDir, 'score.json'), `${JSON.stringify(score, null, 2)}\n`);
    return score;
  }

  /**
   * Pairs the matcher did not suggest but a reviewer should see: identical
   * core names in one county (likely different properties), and one register
   * operator in two settlements (same Provider, different properties).
   */
  private hardCases(
    claimSets: Awaited<ReturnType<CandidateClaimsRepository['loadLatestClaims']>>,
    edges: { left: string; right: string }[],
  ): HardCasePair[] {
    const suggested = new Set(
      edges.flatMap((edge) => [`${edge.left}|${edge.right}`, `${edge.right}|${edge.left}`]),
    );
    const prepared = claimSets.map((set) =>
      prepareCandidate(matchFeaturesFromClaims(set, set.claims)),
    );
    const pairs: HardCasePair[] = [];
    const groupBy = (key: (item: (typeof prepared)[number]) => string[]) => {
      const groups = new Map<string, typeof prepared>();
      for (const item of prepared) {
        for (const value of key(item)) {
          const group = groups.get(value) ?? [];
          group.push(item);
          groups.set(value, group);
        }
      }
      return groups;
    };

    for (const group of groupBy((item) =>
      item.variants.map(
        (variant) => `${item.features.countyCode ?? ''}|${variant.core}#${variant.numbers}`,
      ),
    ).values()) {
      if (group.length < 2 || group.length > 6) continue;
      for (const left of group) {
        for (const right of group) {
          const [a, b] = [left.features, right.features];
          if (
            a.sourceKey !== 'situr_accommodation_register' ||
            b.sourceKey !== 'osm_geofabrik_romania'
          )
            continue;
          if (suggested.has(`${a.candidateId}|${b.candidateId}`)) continue;
          pairs.push({
            kind: 'same_name_different_settlement',
            leftId: a.candidateId,
            rightId: b.candidateId,
          });
        }
      }
    }

    for (const group of groupBy((item) =>
      item.features.taxId === null ? [] : [item.features.taxId],
    ).values()) {
      if (group.length < 2 || group.length > 12) continue;
      for (const left of group) {
        for (const right of group) {
          const [a, b] = [left.features, right.features];
          if (a.sourceRecordKey >= b.sourceRecordKey || a.sourceKey !== b.sourceKey) continue;
          if (a.sourceKey !== ('situr_accommodation_register' satisfies SourceKey)) continue;
          if (a.primarySettlementKey === null || a.primarySettlementKey === b.primarySettlementKey)
            continue;
          pairs.push({
            kind: 'same_operator_different_settlement',
            leftId: a.candidateId,
            rightId: b.candidateId,
          });
        }
      }
    }
    return pairs;
  }
}
