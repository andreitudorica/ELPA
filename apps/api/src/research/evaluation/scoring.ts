import { cohensKappa, f1, type Proportion, proportion } from './metrics';
import type { ReviewTask, SampleItem } from './sampling';

/**
 * Scores matcher and screening decisions against independent reviewer
 * labels. Labels are never inferred: an item counts only when reviewers
 * agree or an adjudicator decided it.
 */
export const DECISIONS: Record<ReviewTask, readonly string[]> = {
  record_match: ['counterpart_found', 'no_counterpart', 'cannot_determine'],
  pair_match: [
    'same_property',
    'same_provider_different_property',
    'different',
    'cannot_determine',
  ],
  eligibility: ['in_scope', 'out_of_scope', 'ambiguous', 'cannot_determine'],
};
export const ADJUDICATOR_ID = 'adjudicator';

export interface LabelRow {
  item_id: string;
  reviewer_id: string;
  decision: string;
  counterpart_osm_ids: string;
}

export interface FinalLabel {
  decision: string;
  counterparts: string[];
  source: 'agreement' | 'adjudication' | 'single_reviewer';
}

/** Normalises `https://www.openstreetmap.org/way/12`, `way/12`, `w12` to `way/12`. */
export function normalizeOsmIds(raw: string): string[] {
  return raw
    .split(/[;,\s]+/)
    .map((part) => {
      const match = /(node|way|relation|[nwr])\/?(\d+)/i.exec(part);
      if (match === null) return null;
      const type =
        { n: 'node', w: 'way', r: 'relation' }[match[1]?.toLowerCase() ?? ''] ??
        match[1]?.toLowerCase();
      return `${type ?? ''}/${match[2] ?? ''}`;
    })
    .filter((id): id is string => id !== null)
    .sort();
}

export function finalLabels(
  items: SampleItem[],
  labels: LabelRow[],
): { final: Map<string, FinalLabel>; disputed: string[]; invalid: string[] } {
  const final = new Map<string, FinalLabel>();
  const disputed: string[] = [];
  const invalid: string[] = [];
  const tasks = new Map(items.map((item) => [item.itemId, item.task]));

  const byItem = new Map<string, LabelRow[]>();
  for (const label of labels) {
    const task = tasks.get(label.item_id);
    if (task === undefined || label.decision === '') continue;
    if (!DECISIONS[task].includes(label.decision)) {
      invalid.push(`${label.item_id}:${label.reviewer_id}`);
      continue;
    }
    const rows = byItem.get(label.item_id) ?? [];
    rows.push(label);
    byItem.set(label.item_id, rows);
  }

  for (const [itemId, rows] of byItem) {
    const adjudication = rows.find((row) => row.reviewer_id === ADJUDICATOR_ID);
    if (adjudication !== undefined) {
      final.set(itemId, {
        decision: adjudication.decision,
        counterparts: normalizeOsmIds(adjudication.counterpart_osm_ids),
        source: 'adjudication',
      });
      continue;
    }
    const reviews = rows.filter((row) => row.reviewer_id !== ADJUDICATOR_ID);
    const signature = (row: LabelRow) =>
      `${row.decision}|${normalizeOsmIds(row.counterpart_osm_ids).join(',')}`;
    const first = reviews[0];
    if (first === undefined) continue;
    if (reviews.every((row) => signature(row) === signature(first))) {
      final.set(itemId, {
        decision: first.decision,
        counterparts: normalizeOsmIds(first.counterpart_osm_ids),
        source: reviews.length > 1 ? 'agreement' : 'single_reviewer',
      });
    } else {
      disputed.push(itemId);
    }
  }
  return { final, disputed, invalid };
}

export interface EvaluationScore {
  labelledItems: number;
  singleReviewerItems: number;
  disputedItems: string[];
  invalidLabels: string[];
  agreement: Record<ReviewTask, { pairs: number; kappa: number | null }>;
  pairMatch: {
    tier: string;
    sources: string;
    relation: string;
    precision: Proportion;
  }[];
  hardCases: { kind: string; confirmedDifferent: Proportion }[];
  recordMatch: {
    recallLikely: Proportion;
    recallLikelyOrPossible: Proportion;
    precisionLikely: Proportion;
    f1Likely: number | null;
    falsePositiveRateLikely: Proportion;
    falseMergeItems: string[];
    missedDuplicateItems: string[];
  };
  eligibility: { screeningClass: string; inScope: Proportion; decided: number }[];
}

export function scoreEvaluation(items: SampleItem[], labels: LabelRow[]): EvaluationScore {
  const { final, disputed, invalid } = finalLabels(items, labels);
  const decided = (itemId: string) => {
    const label = final.get(itemId);
    return label !== undefined && label.decision !== 'cannot_determine' ? label : undefined;
  };

  const agreement = Object.fromEntries(
    (Object.keys(DECISIONS) as ReviewTask[]).map((task) => {
      const reviewers = [
        ...new Set(
          labels
            .filter((label) => label.reviewer_id !== ADJUDICATOR_ID)
            .map((label) => label.reviewer_id),
        ),
      ].sort();
      const [first, second] = reviewers;
      const taskItems = new Set(
        items.filter((item) => item.task === task).map((item) => item.itemId),
      );
      const pairs: [string, string][] = [];
      if (first !== undefined && second !== undefined) {
        const firstLabels = new Map(
          labels
            .filter((label) => label.reviewer_id === first)
            .map((label) => [label.item_id, label.decision]),
        );
        for (const label of labels) {
          const other = firstLabels.get(label.item_id);
          if (label.reviewer_id === second && other !== undefined && taskItems.has(label.item_id)) {
            pairs.push([other, label.decision]);
          }
        }
      }
      return [task, { pairs: pairs.length, kappa: cohensKappa(pairs) }];
    }),
  ) as EvaluationScore['agreement'];

  const pairGroups = new Map<string, { correct: number; total: number }>();
  const hardGroups = new Map<string, { correct: number; total: number }>();
  for (const item of items.filter((candidate) => candidate.task === 'pair_match')) {
    const label = decided(item.itemId);
    if (label === undefined || item.right === null) continue;
    const sources = [item.left.sourceKey, item.right.sourceKey].sort().join('~');
    if (item.key.suggestionId === null) {
      const group = hardGroups.get(item.key.rule ?? '') ?? { correct: 0, total: 0 };
      group.total += 1;
      if (label.decision !== 'same_property') group.correct += 1;
      hardGroups.set(item.key.rule ?? '', group);
      continue;
    }
    const correct =
      item.key.relation === 'same_property'
        ? label.decision === 'same_property'
        : label.decision === 'same_property' ||
          label.decision === 'same_provider_different_property';
    const key = `${item.key.strength ?? ''}|${sources}|${item.key.relation ?? ''}`;
    const group = pairGroups.get(key) ?? { correct: 0, total: 0 };
    group.total += 1;
    if (correct) group.correct += 1;
    pairGroups.set(key, group);
  }

  let withCounterpart = 0;
  let recalledLikely = 0;
  let recalledAny = 0;
  let suggestedLikely = 0;
  let correctLikely = 0;
  let noCounterpart = 0;
  let falsePositiveLikely = 0;
  const falseMergeItems: string[] = [];
  const missedDuplicateItems: string[] = [];
  for (const item of items.filter((candidate) => candidate.task === 'record_match')) {
    const label = decided(item.itemId);
    if (label === undefined) continue;
    const likely = item.key.matcherCounterparts.filter((entry) => entry.strength === 'likely');
    const truth = new Set(label.decision === 'counterpart_found' ? label.counterparts : []);
    const likelyHit = likely.some((entry) => truth.has(entry.sourceRecordKey));
    const anyHit = item.key.matcherCounterparts.some((entry) => truth.has(entry.sourceRecordKey));
    if (truth.size > 0) {
      withCounterpart += 1;
      if (likelyHit) recalledLikely += 1;
      if (anyHit) recalledAny += 1;
      else missedDuplicateItems.push(item.itemId);
    } else {
      noCounterpart += 1;
      if (likely.length > 0) falsePositiveLikely += 1;
    }
    if (likely.length > 0) {
      suggestedLikely += 1;
      if (likelyHit) correctLikely += 1;
      else falseMergeItems.push(item.itemId);
    }
  }
  const recallLikely = proportion(recalledLikely, withCounterpart);
  const precisionLikely = proportion(correctLikely, suggestedLikely);

  const eligibilityGroups = new Map<string, { inScope: number; decided: number }>();
  for (const item of items.filter((candidate) => candidate.task === 'eligibility')) {
    const label = decided(item.itemId);
    if (label === undefined) continue;
    const group = eligibilityGroups.get(item.left.screeningClass) ?? { inScope: 0, decided: 0 };
    group.decided += 1;
    if (label.decision === 'in_scope') group.inScope += 1;
    eligibilityGroups.set(item.left.screeningClass, group);
  }

  return {
    labelledItems: final.size,
    singleReviewerItems: [...final.values()].filter((label) => label.source === 'single_reviewer')
      .length,
    disputedItems: disputed.sort(),
    invalidLabels: invalid.sort(),
    agreement,
    pairMatch: [...pairGroups.entries()]
      .map(([key, group]) => {
        const [tier = '', sources = '', relation = ''] = key.split('|');
        return { tier, sources, relation, precision: proportion(group.correct, group.total) };
      })
      .sort((left, right) =>
        `${left.tier}${left.sources}` < `${right.tier}${right.sources}` ? -1 : 1,
      ),
    hardCases: [...hardGroups.entries()].map(([kind, group]) => ({
      kind,
      confirmedDifferent: proportion(group.correct, group.total),
    })),
    recordMatch: {
      recallLikely,
      recallLikelyOrPossible: proportion(recalledAny, withCounterpart),
      precisionLikely,
      f1Likely: f1(precisionLikely.value, recallLikely.value),
      falsePositiveRateLikely: proportion(falsePositiveLikely, noCounterpart),
      falseMergeItems: falseMergeItems.sort(),
      missedDuplicateItems: missedDuplicateItems.sort(),
    },
    eligibility: [...eligibilityGroups.entries()].map(([screeningClass, group]) => ({
      screeningClass,
      inScope: proportion(group.inScope, group.decided),
      decided: group.decided,
    })),
  };
}
