import {
  conformalThreshold,
  clopperPearsonUpper,
  proportionInterval,
  reliability,
  riskCoverage,
  selectThreshold,
  type ScoredOutcome,
} from './calibration';
import type { z } from 'zod';

import {
  CATEGORY_IDS,
  type scoringItemSchema,
  STRATEGIES,
  type Adjudication,
  type CategoryId,
  type Decision,
  type GoldLabel,
  type Review,
  type Strategy,
} from './contracts';
import { CATEGORIES } from './policy';

export type ScoringItem = z.infer<typeof scoringItemSchema>;

export interface Gold {
  label: GoldLabel;
  reviewers: number;
  adjudicated: boolean;
}

/** Combines independent reviews; disagreements count only after adjudication. */
export function goldLabels(
  corpusDigest: string,
  reviews: readonly Review[],
  adjudication?: Adjudication,
) {
  const errors: string[] = [];
  const reviewers = reviews.map((r) => r.reviewerId);
  if (new Set(reviewers).size !== reviewers.length) errors.push('duplicate_reviewer');
  if (reviews.some((r) => r.corpusDigest !== corpusDigest)) errors.push('review_corpus_mismatch');
  if (adjudication !== undefined) {
    if (adjudication.corpusDigest !== corpusDigest) errors.push('adjudication_corpus_mismatch');
    if (reviewers.includes(adjudication.adjudicatorId)) errors.push('adjudicator_not_independent');
  }
  const byItem = new Map<string, GoldLabel[]>();
  for (const review of reviews) {
    const seen = new Set<string>();
    for (const label of review.labels) {
      if (seen.has(label.itemId)) errors.push(`repeated_label:${review.reviewerId}`);
      seen.add(label.itemId);
      byItem.set(label.itemId, [...(byItem.get(label.itemId) ?? []), label.label]);
    }
  }
  const adjudicated = new Map(adjudication?.decisions.map((d) => [d.itemId, d.label]) ?? []);
  const labels = new Map<string, Gold>();
  const unresolved: string[] = [];
  let doubleReviewed = 0,
    agreements = 0;
  for (const [itemId, values] of byItem) {
    const agree = values.every((v) => v === values[0]);
    if (values.length > 1) {
      doubleReviewed++;
      if (agree) agreements++;
    }
    const first = values[0];
    if (first !== undefined && agree)
      labels.set(itemId, { label: first, reviewers: values.length, adjudicated: false });
    else {
      const label = adjudicated.get(itemId);
      if (label === undefined) unresolved.push(itemId);
      else labels.set(itemId, { label, reviewers: values.length, adjudicated: true });
    }
  }
  return {
    labels,
    unresolved,
    reviewers: [...new Set(reviewers)],
    agreement: {
      doubleReviewed,
      agreements,
      rate: doubleReviewed === 0 ? null : agreements / doubleReviewed,
    },
    errors: [...new Set(errors)],
  };
}

/** Builds a record over a closed key set, keeping each key's value type. */
function byKey<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  const result: Partial<Record<K, V>> = {};
  for (const key of keys) result[key] = value(key);
  return result as Record<K, V>;
}

const proposed = (decision: Decision) => decision.recommendation === 'auto_verify';
const abstained = (decision: Decision) =>
  ['further_research_required', 'insufficient_evidence'].includes(decision.recommendation);

function scored(items: readonly ScoringItem[], gold: Map<string, Gold>, strategy: Strategy) {
  return items.flatMap((item): (ScoredOutcome & { item: ScoringItem })[] => {
    const label = gold.get(item.itemId);
    const decision = item.decisions[strategy];
    return label === undefined
      ? []
      : [
          {
            item,
            score: decision.evidenceScore,
            proposed: proposed(decision),
            correct: label.label === 'supported',
          },
        ];
  });
}

function holdoutMetrics(
  outcomes: readonly (ScoredOutcome & { item: ScoringItem })[],
  threshold: number | null,
  strategy: Strategy,
) {
  const accept = (o: ScoredOutcome) => threshold !== null && o.proposed && o.score >= threshold;
  const accepted = outcomes.filter(accept);
  const falseApprovals = accepted.filter((o) => !o.correct).length;
  const supported = outcomes.filter((o) => o.correct);
  const cost = outcomes
    .filter((o) => o.item.decisions[strategy].assessmentUsed)
    .reduce((sum, o) => sum + (o.item.assessment.costUsd ?? 0), 0);
  const correct = accepted.length - falseApprovals;
  return {
    labeled: outcomes.length,
    autoApprovals: accepted.length,
    correctApprovals: correct,
    falseApprovals,
    falseRejections: supported.filter((o) => !accept(o)).length,
    abstentions: outcomes.filter((o) => abstained(o.item.decisions[strategy])).length,
    contradictionsFlagged: outcomes.filter(
      (o) => o.item.decisions[strategy].recommendation === 'contradicted',
    ).length,
    coverage: proportionInterval(accepted.length, outcomes.length),
    precision: proportionInterval(correct, accepted.length),
    falseApprovalUpper: clopperPearsonUpper(falseApprovals, accepted.length),
    falseNegativeRate: proportionInterval(
      supported.filter((o) => !accept(o)).length,
      supported.length,
    ),
    assessmentCostUsd: Math.round(cost * 1e6) / 1e6,
    costPerCorrectApprovalUsd: correct === 0 ? null : Math.round((cost / correct) * 1e6) / 1e6,
  };
}

export function scoreEvaluation(input: {
  corpusDigest: string;
  items: readonly ScoringItem[];
  reviews: readonly Review[];
  adjudication?: Adjudication;
}) {
  const gold = goldLabels(input.corpusDigest, input.reviews, input.adjudication);
  const groupBy = (
    outcomes: readonly (ScoredOutcome & { item: ScoringItem })[],
    key: (o: ScoredOutcome & { item: ScoringItem }) => string[],
  ) => {
    const groups = new Map<string, (ScoredOutcome & { item: ScoringItem })[]>();
    for (const outcome of outcomes)
      for (const k of key(outcome)) groups.set(k, [...(groups.get(k) ?? []), outcome]);
    return groups;
  };
  const evaluateCategory = (strategy: Strategy, category: CategoryId) => {
    const definition = CATEGORIES[category];
    const all = scored(input.items, gold.labels, strategy);
    const calibration = all.filter(
      (o) => o.item.category === category && o.item.split === 'calibration',
    );
    const holdout = all.filter((o) => o.item.category === category && o.item.split === 'holdout');
    const points = riskCoverage(calibration);
    // Thresholds come only from calibration labels; holdout labels are read afterwards.
    const selected =
      definition.gate === null
        ? null
        : selectThreshold(points, {
            maxPoint: definition.gate.maxFalseApprovalPoint,
            maxUpper: definition.gate.maxFalseApprovalUpper,
          });
    const threshold = selected?.threshold ?? null;
    const metricsBy = (key: (o: ScoredOutcome & { item: ScoringItem }) => string[]) =>
      Object.fromEntries(
        [...groupBy(holdout, key)].map(([k, v]) => [k, holdoutMetrics(v, threshold, strategy)]),
      );
    return {
      calibration: {
        labeled: calibration.length,
        riskCoverage: points,
        selectedThreshold: threshold,
        conformal:
          definition.gate === null
            ? null
            : conformalThreshold(calibration, definition.gate.maxFalseApprovalPoint),
      },
      holdout: holdoutMetrics(holdout, threshold, strategy),
      reliability: reliability(calibration, holdout),
      bySource: metricsBy((o) => [o.item.sourceKey]),
      byCondition: metricsBy((o) => o.item.conditions),
    };
  };
  const strategies = byKey(STRATEGIES, (strategy) =>
    byKey(CATEGORY_IDS, (category) => evaluateCategory(strategy, category)),
  );

  const holdoutIds = input.items.filter((i) => i.split === 'holdout').map((i) => i.itemId);
  const gates = byKey(CATEGORY_IDS, (category) => {
    const definition = CATEGORIES[category];
    const result = strategies.C[category];
    const reasons: string[] = [];
    const holdoutItems = input.items.filter(
      (i) => i.category === category && i.split === 'holdout',
    );
    if (definition.autonomy === 'never') reasons.push('category_never_autonomous');
    if (definition.gate === null) reasons.push('no_gate_defined');
    else {
      const gate = definition.gate;
      if (gold.errors.length > 0) reasons.push(...gold.errors);
      if (gold.reviewers.length < gate.minReviewers)
        reasons.push('insufficient_independent_reviewers');
      if (holdoutItems.some((i) => (gold.labels.get(i.itemId)?.reviewers ?? 0) < gate.minReviewers))
        reasons.push('holdout_not_fully_double_reviewed');
      if (gold.unresolved.some((id) => holdoutIds.includes(id)))
        reasons.push('unadjudicated_disagreements');
      if (gold.agreement.rate === null || gold.agreement.rate < gate.minAgreement)
        reasons.push('reviewer_agreement_below_minimum');
      if (result.calibration.selectedThreshold === null) reasons.push('no_calibrated_threshold');
      if (result.holdout.autoApprovals < gate.minAccepted) reasons.push('holdout_sample_too_small');
      const point =
        result.holdout.precision.value === null ? null : 1 - result.holdout.precision.value;
      if (point === null || point > gate.maxFalseApprovalPoint)
        reasons.push('false_approval_rate_above_gate');
      if (
        result.holdout.falseApprovalUpper === null ||
        result.holdout.falseApprovalUpper > gate.maxFalseApprovalUpper
      )
        reasons.push('false_approval_upper_bound_above_gate');
    }
    return {
      passed: reasons.length === 0,
      threshold: result.calibration.selectedThreshold,
      reasons: [...new Set(reasons)],
    };
  });

  return {
    status: gold.labels.size === 0 ? 'independent_labels_missing' : 'scored',
    labels: {
      reviewers: gold.reviewers.length,
      labeledItems: gold.labels.size,
      unresolved: gold.unresolved.length,
      agreement: gold.agreement,
      errors: gold.errors,
    },
    strategies,
    gates,
  };
}

/** Label-free observations: what each strategy proposes, and what it costs. */
export function observedSummary(items: readonly ScoringItem[]) {
  const count = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length]),
    );
  const assessed = items.filter((i) => i.assessment.status !== 'unavailable');
  return {
    items: items.length,
    bySplit: count(items.map((i) => i.split)),
    byCategory: count(items.map((i) => i.category ?? 'unclassified')),
    strategies: byKey(STRATEGIES, (strategy) => {
      const used = items.filter((i) => i.decisions[strategy].assessmentUsed);
      return {
        recommendations: count(items.map((i) => i.decisions[strategy].recommendation)),
        outcomes: count(items.map((i) => i.decisions[strategy].outcome)),
        byCategory: byKey(CATEGORY_IDS, (category) =>
          count(
            items
              .filter((i) => i.category === category)
              .map((i) => i.decisions[strategy].recommendation),
          ),
        ),
        assessmentCalls: used.filter((i) => i.assessment.costUsd !== null).length,
        assessmentCostUsd:
          Math.round(used.reduce((s, i) => s + (i.assessment.costUsd ?? 0), 0) * 1e6) / 1e6,
        assessmentLatencyMs: Math.round(
          used.reduce((s, i) => s + (i.assessment.latencyMs ?? 0), 0),
        ),
      };
    }),
    assessments: {
      assessed: assessed.length,
      status: count(assessed.map((i) => i.assessment.status)),
      verdicts: count(
        assessed.flatMap((i) => (i.assessment.verdict === null ? [] : [i.assessment.verdict])),
      ),
      errors: count(assessed.flatMap((i) => i.assessment.errors)),
      unavailable: count(
        items
          .filter((i) => i.assessment.status === 'unavailable')
          .flatMap((i) => i.assessment.errors),
      ),
    },
    followUp: {
      applied: items.filter(
        (i) => i.followUp !== null && i.followUp.termination !== 'not_applicable',
      ).length,
      terminations: count(
        items.flatMap((i) => (i.followUp === null ? [] : [i.followUp.termination])),
      ),
      changedRecommendation: items.filter(
        (i) =>
          i.followUp !== null &&
          i.followUp.termination !== 'not_applicable' &&
          i.decisions.C.reasons.some((r) => r.startsWith('follow_up_')),
      ).length,
    },
    verified: items.filter((i) => STRATEGIES.some((s) => i.decisions[s].outcome === 'verified'))
      .length,
  };
}
