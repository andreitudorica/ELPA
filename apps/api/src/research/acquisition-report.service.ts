import { Injectable } from '@nestjs/common';

import { NotFoundError } from '../common';
import { ROMANIAN_COUNTIES } from './acquisition/romania-geography';
import { SOURCE_DEFINITIONS } from './acquisition/sources';
import { SCREENING_CLASSES, SOURCE_KEYS, type SourceKey } from './acquisition/source-record';
import { AcquisitionQueryRepository, type RunRow } from './acquisition-query.repository';
import { UnionFind } from './grouping/union-find';
import { MATCHER_VERSION } from './matching/duplicate-matcher';
import { ResearchCampaignRepository } from './research-campaign.repository';

/**
 * Data-quality and cross-source report for one Research Campaign, computed
 * from stored records. Every figure is labelled as an observed count, an
 * estimate under unverified matcher decisions, or unknown. Nothing here is a
 * verified count: no Candidate has passed Verification.
 */
export const REPORT_VERSION = 'grp-acquisition-report@1';

const REPORTED_TARGETS = [
  'offer.name',
  'offer.primary_locality',
  'offer.coordinates',
  'offer.address',
  'offer.sleeps_persons',
  'offer.units_count',
  'offer.rooms_count',
  'offer.beds_count',
  'offer.capacity_persons',
  'offer.registry_classification',
  'offer.registry_certificate',
  'offer.website',
  'offer.business_email_domain',
  'provider_hint.legal_name',
  'provider_hint.tax_id',
  'provider_hint.operator',
] as const;

const IN_SCOPE_CLASSES = ['plausible', 'ambiguous'];

export type CountByLabel = Record<string, number>;

export interface SourceQuality {
  sourceKey: SourceKey;
  label: string;
  reuseTerms: string;
  retentionPolicy: string;
  attribution: string;
  artifacts: {
    sha256: string;
    datasetVersion: string | null;
    retrievedAt: string;
    byteSize: number;
    originalUrl: string;
  }[];
  latestRun: {
    id: string;
    status: string;
    startedAt: string;
    parserVersion: string;
    normalizerVersion: string;
    outputDigest: string | null;
  } | null;
  runsByStatus: CountByLabel;
  /** Distinct output digests across successful runs of the same versions; 1 means reproducible. */
  distinctOutputDigests: number;
  records: {
    read: number;
    parsed: number;
    rejected: number;
    rejectionsByCode: CountByLabel;
    excludedBySource: CountByLabel;
  };
  candidates: number;
  screening: CountByLabel;
  missingIdentifiers: { count: number; definition: string };
  derivedKeyCollisions: number;
  missingLocation: { withoutCounty: number; withoutSettlement: number; withoutCoordinates: number };
  fieldCompleteness: { target: string; candidates: number; share: number }[];
}

export interface AcquisitionReport {
  reportVersion: string;
  generatedAt: string;
  campaign: { id: string; name: string; county: string | null; locality: string | null };
  labelling: { observed: string; estimate: string; notVerified: string };
  sources: SourceQuality[];
  crossSource: {
    matcherVersion: string;
    suggestions: {
      relation: string;
      strength: string;
      rule: string;
      sources: string;
      count: number;
    }[];
    registerWithOsmCounterpart: { likely: number; likelyOrPossible: number; total: number };
    osmWithRegisterCounterpart: { likely: number; likelyOrPossible: number; total: number };
    candidatesWithOnlyPossibleMatches: number;
    distinctPropertyEstimate: {
      candidates: number;
      likelyClustersOnly: number;
      likelyAndPossibleClusters: number;
      definition: string;
    };
    incrementalInScopeCandidates: {
      registerOnly: number;
      osmOnly: number;
      inBoth: number;
      definition: string;
    };
    registerOperatorGroups: { groups: number; candidates: number; largest: number };
  };
  coverage: {
    referencePopulation: string;
    size: number;
    reconciledLikely: number;
    reconciledLikelyOrPossible: number;
    shareLikely: number;
    shareLikelyOrPossible: number;
    byCounty: {
      countyCode: string;
      countyName: string;
      size: number;
      reconciledLikely: number;
      reconciledLikelyOrPossible: number;
    }[];
    caveat: string;
  };
  entityResolution: {
    status: 'not_measured';
    reason: string;
    protocol: string;
  };
  unknowns: string[];
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10000) / 10000;
}

@Injectable()
export class AcquisitionReportService {
  constructor(
    private readonly campaigns: ResearchCampaignRepository,
    private readonly queries: AcquisitionQueryRepository,
  ) {}

  async build(researchCampaignId: string): Promise<AcquisitionReport> {
    const campaign = await this.campaigns.findById(researchCampaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`Research Campaign ${researchCampaignId} does not exist`);
    }

    const [runs, counts, coverageRows, members, edges, operatorGroups] = await Promise.all([
      this.queries.listRuns(campaign.id),
      this.queries.candidateCounts(campaign.id),
      this.queries.claimTargetCoverage(campaign.id),
      this.queries.candidatesForClustering(campaign.id),
      this.queries.suggestionEdges(campaign.id, MATCHER_VERSION),
      this.queries.registerOperatorGroups(campaign.id),
    ]);

    const sources = SOURCE_KEYS.filter(
      (sourceKey) =>
        runs.some((run) => run.sourceKey === sourceKey) ||
        counts.some((row) => row.sourceKey === sourceKey),
    ).map((sourceKey) =>
      this.sourceQuality(
        sourceKey,
        runs.filter((run) => run.sourceKey === sourceKey && run.stage === 'import'),
        counts.filter((row) => row.sourceKey === sourceKey),
        coverageRows.filter((row) => row.sourceKey === sourceKey),
      ),
    );

    const sourceOf = new Map(members.map((member) => [member.id, member.sourceKey as SourceKey]));
    const sameProperty = edges.filter((edge) => edge.relation === 'same_property');
    const counterparts = (strengths: string[]) => {
      const matched = new Set<string>();
      for (const edge of sameProperty) {
        if (!strengths.includes(edge.strength)) continue;
        const pair = [sourceOf.get(edge.left), sourceOf.get(edge.right)];
        if (
          !pair.includes('situr_accommodation_register') ||
          !pair.includes('osm_geofabrik_romania')
        )
          continue;
        matched.add(edge.left);
        matched.add(edge.right);
      }
      return matched;
    };
    const likelyMatched = counterparts(['likely']);
    const anyMatched = counterparts(['likely', 'possible']);
    const register = members.filter(
      (member) => member.sourceKey === 'situr_accommodation_register',
    );
    const osm = members.filter((member) => member.sourceKey === 'osm_geofabrik_romania');

    const withSuggestion = new Map<string, Set<string>>();
    for (const edge of sameProperty) {
      for (const id of [edge.left, edge.right]) {
        const strengths = withSuggestion.get(id) ?? new Set<string>();
        strengths.add(edge.strength);
        withSuggestion.set(id, strengths);
      }
    }

    const likelyClusters = new UnionFind();
    const allClusters = new UnionFind();
    for (const edge of sameProperty) {
      allClusters.union(edge.left, edge.right);
      if (edge.strength === 'likely') likelyClusters.union(edge.left, edge.right);
    }
    const ids = members.map((member) => member.id);

    const inScope = (member: (typeof members)[number]) =>
      IN_SCOPE_CLASSES.includes(member.screeningClass);
    const registerInScope = register.filter(inScope);
    const osmInScope = osm.filter(inScope);

    const suggestionGroups = new Map<string, number>();
    for (const edge of edges) {
      const key = [
        edge.relation,
        edge.strength,
        edge.rule,
        [sourceOf.get(edge.left), sourceOf.get(edge.right)].sort().join('~'),
      ].join('|');
      suggestionGroups.set(key, (suggestionGroups.get(key) ?? 0) + 1);
    }

    const byCounty = Object.entries(ROMANIAN_COUNTIES)
      .map(([countyCode, countyName]) => {
        const population = registerInScope.filter((member) => member.countyCode === countyCode);
        return {
          countyCode,
          countyName,
          size: population.length,
          reconciledLikely: population.filter((member) => likelyMatched.has(member.id)).length,
          reconciledLikelyOrPossible: population.filter((member) => anyMatched.has(member.id))
            .length,
        };
      })
      .filter((row) => row.size > 0);

    return {
      reportVersion: REPORT_VERSION,
      generatedAt: new Date().toISOString(),
      campaign: {
        id: campaign.id,
        name: campaign.name,
        county: campaign.county,
        locality: campaign.locality,
      },
      labelling: {
        observed: 'Counted directly from stored source records, Evidence, Claims, and suggestions.',
        estimate: 'Derived from unverified matcher suggestions; a range, not a fact.',
        notVerified:
          'No Candidate has passed Verification; no figure is a verified property count.',
      },
      sources,
      crossSource: {
        matcherVersion: MATCHER_VERSION,
        suggestions: [...suggestionGroups.entries()]
          .map(([key, count]) => {
            const [relation = '', strength = '', rule = '', pairSources = ''] = key.split('|');
            return { relation, strength, rule, sources: pairSources, count };
          })
          .sort((left, right) => right.count - left.count),
        registerWithOsmCounterpart: {
          likely: register.filter((member) => likelyMatched.has(member.id)).length,
          likelyOrPossible: register.filter((member) => anyMatched.has(member.id)).length,
          total: register.length,
        },
        osmWithRegisterCounterpart: {
          likely: osm.filter((member) => likelyMatched.has(member.id)).length,
          likelyOrPossible: osm.filter((member) => anyMatched.has(member.id)).length,
          total: osm.length,
        },
        candidatesWithOnlyPossibleMatches: [...withSuggestion.values()].filter(
          (strengths) => !strengths.has('likely'),
        ).length,
        distinctPropertyEstimate: {
          candidates: ids.length,
          likelyClustersOnly: likelyClusters.count(ids),
          likelyAndPossibleClusters: allClusters.count(ids),
          definition:
            'Connected components of same-property suggestions. Using only likely suggestions merges least (upper bound of distinct properties); adding possible suggestions merges most (lower bound). Both rest on unverified decisions.',
        },
        incrementalInScopeCandidates: {
          registerOnly: registerInScope.filter((member) => !anyMatched.has(member.id)).length,
          osmOnly: osmInScope.filter((member) => !anyMatched.has(member.id)).length,
          inBoth: registerInScope.filter((member) => anyMatched.has(member.id)).length,
          definition:
            'Candidates screened plausible or ambiguous (rubric v1) with no cross-source same-property suggestion of any strength. These are what each source adds that the other does not visibly contain.',
        },
        registerOperatorGroups: operatorGroups,
      },
      coverage: {
        referencePopulation:
          'Current official-register Candidates in campaign scope screened plausible or ambiguous by rubric v1 (automated screening, not verified eligibility).',
        size: registerInScope.length,
        reconciledLikely: registerInScope.filter((member) => likelyMatched.has(member.id)).length,
        reconciledLikelyOrPossible: registerInScope.filter((member) => anyMatched.has(member.id))
          .length,
        shareLikely: share(
          registerInScope.filter((member) => likelyMatched.has(member.id)).length,
          registerInScope.length,
        ),
        shareLikelyOrPossible: share(
          registerInScope.filter((member) => anyMatched.has(member.id)).length,
          registerInScope.length,
        ),
        byCounty,
        caveat:
          'This is the share of a defined official-register subset that OpenStreetMap can be reconciled with, under unverified suggestions. It is not the share of all Romanian group-rental properties: unregistered properties and the true eligible population are unknown.',
      },
      entityResolution: {
        status: 'not_measured',
        reason: `No independently reviewed labels have been recorded for ${MATCHER_VERSION}. Precision, recall, and F1 are not reported until the review protocol is completed.`,
        protocol: 'docs/research/group-rental-property-baseline/evaluation-protocol.md',
      },
      unknowns: [
        'Whether any Candidate is rentable as a whole property or accepts private events (neither source states it).',
        'The number of group-rental properties operating without a classification certificate.',
        'Matcher precision and recall (pending independent review).',
        'Stability of derived register record keys across future register versions (one version observed).',
      ],
    };
  }

  private sourceQuality(
    sourceKey: SourceKey,
    runs: RunRow[],
    counts: {
      screeningClass: string;
      withCounty: number;
      withSettlement: number;
      derivedKeyCollisions: number;
      total: number;
    }[],
    coverage: { target: string; candidates: number }[],
  ): SourceQuality {
    const source = SOURCE_DEFINITIONS[sourceKey];
    const completed = runs.filter((run) => run.status !== 'failed' && run.status !== 'running');
    const latest = completed[0] ?? runs[0] ?? null;
    const stats = (latest?.stats ?? {}) as Record<string, unknown>;
    const number = (value: unknown) => (typeof value === 'number' ? value : 0);
    const record = (value: unknown) =>
      value !== null && typeof value === 'object' ? (value as Record<string, number>) : {};

    const candidates = counts.reduce((sum, row) => sum + row.total, 0);
    const coverageOf = (target: string) =>
      coverage.find((row) => row.target === target)?.candidates ?? 0;
    const sameVersions = completed.filter(
      (run) =>
        run.parserVersion === latest?.parserVersion &&
        run.normalizerVersion === latest.normalizerVersion &&
        run.artifact.datasetVersion === latest.artifact.datasetVersion,
    );

    const artifacts = new Map<string, SourceQuality['artifacts'][number]>();
    for (const run of runs) {
      artifacts.set(run.artifact.sha256, {
        sha256: run.artifact.sha256,
        datasetVersion: run.artifact.datasetVersion,
        retrievedAt: run.artifact.retrievedAt.toISOString(),
        byteSize: run.artifact.byteSize,
        originalUrl: run.artifact.originalUrl,
      });
    }
    const runsByStatus: CountByLabel = {};
    for (const run of runs) runsByStatus[run.status] = (runsByStatus[run.status] ?? 0) + 1;
    const screening: CountByLabel = Object.fromEntries(
      SCREENING_CLASSES.map((value) => [value, 0]),
    );
    for (const row of counts)
      screening[row.screeningClass] = (screening[row.screeningClass] ?? 0) + row.total;

    return {
      sourceKey,
      label: source.label,
      reuseTerms: source.reuseTerms,
      retentionPolicy: source.retentionPolicy,
      attribution: source.attribution,
      artifacts: [...artifacts.values()],
      latestRun:
        latest === null
          ? null
          : {
              id: latest.id,
              status: latest.status,
              startedAt: latest.startedAt.toISOString(),
              parserVersion: latest.parserVersion,
              normalizerVersion: latest.normalizerVersion,
              outputDigest: latest.outputDigest,
            },
      runsByStatus,
      distinctOutputDigests: new Set(sameVersions.map((run) => run.outputDigest)).size,
      records: {
        read: number(stats.recordsRead),
        parsed: number(stats.recordsParsed),
        rejected: number(stats.recordsRejected),
        rejectionsByCode: record(stats.rejectionsByCode),
        excludedBySource: record(stats.excludedBySource),
      },
      candidates,
      screening,
      missingIdentifiers:
        sourceKey === 'situr_accommodation_register'
          ? {
              count: candidates - coverageOf('offer.registry_certificate'),
              definition:
                'Register rows without a classification certificate number or date; their record key relies on name and locality only.',
            }
          : {
              count: 0,
              definition: 'Every accepted source record has a native identifier.',
            },
      derivedKeyCollisions: counts.reduce((sum, row) => sum + row.derivedKeyCollisions, 0),
      missingLocation: {
        withoutCounty: candidates - counts.reduce((sum, row) => sum + row.withCounty, 0),
        withoutSettlement: candidates - counts.reduce((sum, row) => sum + row.withSettlement, 0),
        withoutCoordinates: candidates - coverageOf('offer.coordinates'),
      },
      fieldCompleteness: REPORTED_TARGETS.map((target) => ({
        target,
        candidates: coverageOf(target),
        share: share(coverageOf(target), candidates),
      })),
    };
  }
}
