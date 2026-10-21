import { canonicalJson } from '../acquisition/source-record';
import { type CandidateClaimSet } from '../candidate-claims.repository';
import { partitionOf } from '../evaluation/partition';
import { NEXT_SOURCE_VERSION } from './sampling';

export const PRIORITY_TARGETS = [
  'offer.sleeps_persons',
  'offer.max_daytime_guests',
  'offer.parties_allowed',
  'offer.quiet_hours_start',
  'offer.quiet_hours_end',
  'offer.music_policy',
  'offer.outdoor_grill',
  'offer.outdoor_covered_area',
  'offer.pool',
  'offer.hot_tub',
] as const;

export interface ComparisonMember {
  id: string;
  screeningClass: string;
  countyCode: string | null;
}
export interface ComparisonEdge {
  left: string;
  right: string;
  relation: string;
  strength: string;
}

/** Predictions remain separate from review labels and never update Candidates. */
export function compareIncrementalSource(
  claimSets: CandidateClaimSet[],
  members: ComparisonMember[],
  edges: ComparisonEdge[],
) {
  const baseline = claimSets.filter((row) => row.sourceKey !== 'overture_places');
  const added = claimSets.filter((row) => row.sourceKey === 'overture_places');
  const baselineIds = new Set(baseline.map((row) => row.id));
  const memberById = new Map(members.map((row) => [row.id, row]));
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  const predictions = added.map((row) => {
    const matches = edges.filter(
      (edge) =>
        edge.relation === 'same_property' &&
        ((edge.left === row.id && baselineIds.has(edge.right)) ||
          (edge.right === row.id && baselineIds.has(edge.left))),
    );
    const likely = matches.filter((edge) => edge.strength === 'likely');
    const member = memberById.get(row.id);
    const classification =
      member?.screeningClass === 'out_of_scope'
        ? 'out_of_scope'
        : row.claims['offer.name'] === undefined || member?.screeningClass === 'insufficient_data'
          ? 'unresolvable'
          : likely.length > 0
            ? 'likely_existing_unreviewed'
            : matches.length > 0
              ? 'potential_existing'
              : 'apparent_discovery_unreviewed';
    const counterpartIds = [
      ...new Set(matches.map((edge) => (edge.left === row.id ? edge.right : edge.left))),
    ].sort();
    const likelyIds = [
      ...new Set(likely.map((edge) => (edge.left === row.id ? edge.right : edge.left))),
    ].sort();
    const priority = PRIORITY_TARGETS.map((target) => {
      const value = row.claims[target];
      const known = likelyIds.flatMap((id) => {
        const v = baselineById.get(id)?.claims[target];
        return v === undefined ? [] : [v];
      });
      const status =
        value === undefined
          ? 'unknown'
          : known.some((v) => canonicalJson(v) === canonicalJson(value))
            ? 'already_supported'
            : known.length > 0
              ? 'potential_contradiction_unreviewed'
              : likelyIds.length > 0
                ? 'new_explicit_conditional_on_match'
                : 'unmatched_observation';
      return { target, status };
    });
    const websiteKeys = (set: CandidateClaimSet | undefined) => {
      const value = set?.claims['offer.website'];
      return Array.isArray(value)
        ? value.flatMap((entry) => {
            if (
              entry !== null &&
              typeof entry === 'object' &&
              !Array.isArray(entry) &&
              typeof entry.identityKey === 'string'
            )
              return [entry.identityKey];
            return [];
          })
        : [];
    };
    const knownWeb = new Set(likelyIds.flatMap((id) => websiteKeys(baselineById.get(id))));
    const newWeb = [...new Set(websiteKeys(row))].filter((key) => !knownWeb.has(key));
    return {
      candidateId: row.id,
      sourceRecordKey: row.sourceRecordKey,
      countyCode: row.countyCode,
      partition: partitionOf('overture_places', row.sourceRecordKey),
      screeningClass: member?.screeningClass ?? 'insufficient_data',
      classification,
      counterpartIds,
      likelyIds,
      priority,
      additionalWebsiteIdentitiesConditionalOnMatch: likelyIds.length > 0 ? newWeb.length : 0,
    };
  });
  const counts = (rows: typeof predictions) =>
    Object.fromEntries(
      [
        'likely_existing_unreviewed',
        'potential_existing',
        'apparent_discovery_unreviewed',
        'out_of_scope',
        'unresolvable',
      ].map((key) => [key, rows.filter((row) => row.classification === key).length]),
    );
  const counties = [...new Set(added.map((row) => row.countyCode))].sort();
  return {
    report: {
      experimentVersion: NEXT_SOURCE_VERSION,
      status: 'independent_review_pending',
      before: {
        candidateRecords: baseline.length,
        screenedPlausibleOrAmbiguous: members.filter(
          (row) =>
            baselineIds.has(row.id) && ['plausible', 'ambiguous'].includes(row.screeningClass),
        ).length,
        independentlyConfirmedNewProperties: null,
      },
      after: {
        candidateRecords: baseline.length + added.length,
        addedCandidateRecords: added.length,
        classifications: counts(predictions),
        holdoutClassifications: counts(predictions.filter((row) => row.partition === 'evaluation')),
        screenedPlausibleOrAmbiguous: members.filter((row) =>
          ['plausible', 'ambiguous'].includes(row.screeningClass),
        ).length,
      },
      priorityAttributes: PRIORITY_TARGETS.map((target) => ({
        target,
        baselineCandidateObservations: baseline.filter((row) => row.claims[target] !== undefined)
          .length,
        newSourceObservations: added.filter((row) => row.claims[target] !== undefined).length,
        conditionalNewObservations: predictions.filter((row) =>
          row.priority.some(
            (entry) =>
              entry.target === target && entry.status === 'new_explicit_conditional_on_match',
          ),
        ).length,
        independentlySupportedNewFacts: null,
      })),
      identityEnrichment: {
        additionalWebsiteIdentitiesConditionalOnUnreviewedMatches: predictions.reduce(
          (sum, row) => sum + row.additionalWebsiteIdentitiesConditionalOnMatch,
          0,
        ),
        caveat:
          'Candidate-level identity hints, not deduplicated property facts or independent corroboration.',
      },
      geographicDistribution: counties.map((county) => ({
        county,
        baselineRecords: baseline.filter((row) => row.countyCode === county).length,
        addedRecords: added.filter((row) => row.countyCode === county).length,
        ...counts(predictions.filter((row) => row.countyCode === county)),
      })),
      independentEvaluation: {
        reviewed: 0,
        confirmedNew: null,
        falseMerges: null,
        precision: null,
        recall: null,
        confidenceInterval: null,
        disagreements: null,
      },
      investmentDecision: 'investigate_further',
      limitations: [
        'Unmatched records are not confirmed new properties; whole-rental eligibility is unknown.',
        'County metadata restricts the sampling frame; no national extrapolation is valid.',
        'Source-record counts and screening counts are not unique or verified property counts.',
        'No priority attribute can be inferred from an Overture category or website pointer.',
        'No independent labels were available; precision, false-merge risk, and ROI are not measured.',
      ],
    },
    predictions,
  };
}
