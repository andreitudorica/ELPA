import { sha256Hex, type SourceKey } from '../acquisition/source-record';
import { pairPartition, partitionOf } from './partition';

/**
 * Deterministic stratified sampling of review items from the evaluation
 * partition. Within each stratum, items are ranked by a seeded hash of their
 * identity and the first `quota` are taken, so the same inputs always yield
 * the same sample and no item is chosen by looking at its content.
 */
export const SAMPLE_VERSION = 'grp-eval-sample@1';
export const SAMPLE_SEED = 'elpa-grp-baseline-2026-10';

export const QUOTAS = {
  record_match: 4,
  pair_match: 6,
  hard_case: 12,
  eligibility: 5,
} as const;

export type ReviewTask = 'record_match' | 'pair_match' | 'eligibility';

export interface SampleCandidate {
  id: string;
  sourceKey: SourceKey;
  sourceRecordKey: string;
  sourceRecordUrl: string | null;
  displayName: string;
  countyCode: string | null;
  settlementName: string | null;
  screeningClass: string;
  structureType: string | null;
  urbanity: string;
  sleepsPersons: number | null;
  address: string | null;
}

export interface SampleSuggestion {
  id: string;
  leftId: string;
  rightId: string;
  relation: string;
  strength: string;
  rule: string;
}

export interface HardCasePair {
  kind: 'same_name_different_settlement' | 'same_operator_different_settlement';
  leftId: string;
  rightId: string;
}

export interface SampleItem {
  itemId: string;
  task: ReviewTask;
  stratum: string;
  left: SampleCandidate;
  right: SampleCandidate | null;
  /** Matcher outcome; kept out of the blind review sheet. */
  key: {
    suggestionId: string | null;
    relation: string | null;
    strength: string | null;
    rule: string | null;
    /** For record_match: OSM counterparts the matcher suggested, by strength. */
    matcherCounterparts: { sourceRecordKey: string; strength: string }[];
  };
}

export function structureGroup(structureType: string | null): string {
  const type = structureType?.replace(/^(situr|osm):/, '') ?? '';
  if (['pensiune_turistica', 'pensiune_agroturistica', 'guest_house'].includes(type))
    return 'guest_house';
  if (['camere_de_inchiriat', 'apartamente_de_inchiriat', 'apartment'].includes(type))
    return 'rooms_or_apartments';
  if (['vila_turistica', 'cabana_turistica', 'chalet'].includes(type)) return 'whole_dwelling';
  if (['casute_tip_camping', 'bungalouri', 'sat_de_vacanta', 'camp_site'].includes(type))
    return 'complex';
  return 'other';
}

function rank(identity: string): string {
  return sha256Hex(`${SAMPLE_SEED}:${identity}`);
}

function takeStratified<T>(
  items: T[],
  stratumOf: (item: T) => string,
  identityOf: (item: T) => string,
  quota: number,
): { item: T; stratum: string }[] {
  const strata = new Map<string, T[]>();
  for (const item of items) {
    const stratum = stratumOf(item);
    const members = strata.get(stratum) ?? [];
    members.push(item);
    strata.set(stratum, members);
  }
  return [...strata.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .flatMap(([stratum, members]) =>
      members
        .map((item) => ({ item, order: rank(identityOf(item)) }))
        .sort((left, right) => (left.order < right.order ? -1 : 1))
        .slice(0, quota)
        .map(({ item }) => ({ item, stratum })),
    );
}

const IN_SCOPE = new Set(['plausible', 'ambiguous']);

export function drawEvaluationSample(
  candidates: SampleCandidate[],
  suggestions: SampleSuggestion[],
  hardCases: HardCasePair[],
): { items: SampleItem[]; strataSizes: Record<string, number> } {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const strataSizes: Record<string, number> = {};
  const count = (stratum: string) => (strataSizes[stratum] = (strataSizes[stratum] ?? 0) + 1);
  const items: SampleItem[] = [];
  const itemId = (task: string, identity: string) => `${task}:${sha256Hex(identity).slice(0, 12)}`;
  // Ranks depend only on source record identities, never on database ids.
  const recordIdentity = (candidateId: string) => {
    const candidate = byId.get(candidateId);
    return candidate === undefined
      ? candidateId
      : `${candidate.sourceKey}:${candidate.sourceRecordKey}`;
  };

  // Record-centric matching: start from register records, so missed duplicates are observable.
  const counterparts = new Map<string, { sourceRecordKey: string; strength: string }[]>();
  for (const suggestion of suggestions) {
    if (suggestion.relation !== 'same_property') continue;
    const left = byId.get(suggestion.leftId);
    const right = byId.get(suggestion.rightId);
    if (left === undefined || right === undefined || left.sourceKey === right.sourceKey) continue;
    const [register, osm] =
      left.sourceKey === 'situr_accommodation_register' ? [left, right] : [right, left];
    const list = counterparts.get(register.id) ?? [];
    list.push({ sourceRecordKey: osm.sourceRecordKey, strength: suggestion.strength });
    counterparts.set(register.id, list);
  }
  const outcome = (candidate: SampleCandidate) => {
    const list = counterparts.get(candidate.id) ?? [];
    return list.some((entry) => entry.strength === 'likely')
      ? 'likely'
      : list.length > 0
        ? 'possible'
        : 'none';
  };
  const registerPopulation = candidates.filter(
    (candidate) =>
      candidate.sourceKey === 'situr_accommodation_register' &&
      IN_SCOPE.has(candidate.screeningClass) &&
      partitionOf(candidate.sourceKey, candidate.sourceRecordKey) === 'evaluation',
  );
  const recordStratum = (candidate: SampleCandidate) =>
    `record_match|${outcome(candidate)}|${candidate.urbanity}|${structureGroup(candidate.structureType)}`;
  registerPopulation.forEach((candidate) => count(recordStratum(candidate)));
  for (const { item, stratum } of takeStratified(
    registerPopulation,
    recordStratum,
    (candidate) => candidate.sourceRecordKey,
    QUOTAS.record_match,
  )) {
    items.push({
      itemId: itemId('record_match', item.sourceRecordKey),
      task: 'record_match',
      stratum,
      left: item,
      right: null,
      key: {
        suggestionId: null,
        relation: null,
        strength: outcome(item),
        rule: null,
        matcherCounterparts: (counterparts.get(item.id) ?? []).sort((left, right) =>
          left.sourceRecordKey < right.sourceRecordKey ? -1 : 1,
        ),
      },
    });
  }

  // Pair-centric matching: precision of each decision rule and tier.
  const evaluationSuggestions = suggestions.filter((suggestion) => {
    const left = byId.get(suggestion.leftId);
    const right = byId.get(suggestion.rightId);
    return left !== undefined && right !== undefined && pairPartition(left, right) === 'evaluation';
  });
  const pairSources = (suggestion: SampleSuggestion) =>
    [byId.get(suggestion.leftId)?.sourceKey, byId.get(suggestion.rightId)?.sourceKey]
      .sort()
      .join('~');
  const pairStratum = (suggestion: SampleSuggestion) =>
    `pair_match|${pairSources(suggestion)}|${suggestion.relation}|${suggestion.strength}|${suggestion.rule}`;
  evaluationSuggestions.forEach((suggestion) => count(pairStratum(suggestion)));
  for (const { item, stratum } of takeStratified(
    evaluationSuggestions,
    pairStratum,
    (suggestion) =>
      `${recordIdentity(suggestion.leftId)}~${recordIdentity(suggestion.rightId)}:${suggestion.relation}`,
    QUOTAS.pair_match,
  )) {
    const left = byId.get(item.leftId);
    const right = byId.get(item.rightId);
    if (left === undefined || right === undefined) continue;
    items.push({
      itemId: itemId(
        'pair_match',
        `${left.sourceRecordKey}:${right.sourceRecordKey}:${item.relation}`,
      ),
      task: 'pair_match',
      stratum,
      left,
      right,
      key: {
        suggestionId: item.id,
        relation: item.relation,
        strength: item.strength,
        rule: item.rule,
        matcherCounterparts: [],
      },
    });
  }

  // Hard cases the matcher did not suggest: similar names elsewhere, one operator in two places.
  const evaluationHardCases = hardCases.filter((pair) => {
    const left = byId.get(pair.leftId);
    const right = byId.get(pair.rightId);
    return left !== undefined && right !== undefined && pairPartition(left, right) === 'evaluation';
  });
  evaluationHardCases.forEach((pair) => count(`pair_match|hard_case|${pair.kind}`));
  for (const { item, stratum } of takeStratified(
    evaluationHardCases,
    (pair) => `pair_match|hard_case|${pair.kind}`,
    (pair) => `${recordIdentity(pair.leftId)}~${recordIdentity(pair.rightId)}:${pair.kind}`,
    QUOTAS.hard_case,
  )) {
    const left = byId.get(item.leftId);
    const right = byId.get(item.rightId);
    if (left === undefined || right === undefined) continue;
    items.push({
      itemId: itemId('pair_match', `${left.sourceRecordKey}:${right.sourceRecordKey}:${item.kind}`),
      task: 'pair_match',
      stratum,
      left,
      right,
      key: {
        suggestionId: null,
        relation: null,
        strength: 'none',
        rule: item.kind,
        matcherCounterparts: [],
      },
    });
  }

  // Eligibility: does rubric-v1 screening agree with reviewers using external evidence?
  const eligibilityPopulation = candidates.filter(
    (candidate) => partitionOf(candidate.sourceKey, candidate.sourceRecordKey) === 'evaluation',
  );
  const eligibilityStratum = (candidate: SampleCandidate) =>
    `eligibility|${candidate.sourceKey}|${candidate.screeningClass}|${candidate.urbanity}`;
  eligibilityPopulation.forEach((candidate) => count(eligibilityStratum(candidate)));
  for (const { item, stratum } of takeStratified(
    eligibilityPopulation,
    eligibilityStratum,
    (candidate) => `eligibility:${candidate.sourceKey}:${candidate.sourceRecordKey}`,
    QUOTAS.eligibility,
  )) {
    items.push({
      itemId: itemId('eligibility', `${item.sourceKey}:${item.sourceRecordKey}`),
      task: 'eligibility',
      stratum,
      left: item,
      right: null,
      key: {
        suggestionId: null,
        relation: null,
        strength: null,
        rule: null,
        matcherCounterparts: [],
      },
    });
  }

  return { items, strataSizes };
}
