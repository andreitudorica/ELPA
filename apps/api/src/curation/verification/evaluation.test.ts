import { describe, expect, it } from 'vitest';

import type { Assessment, Decision, Review, Split } from './contracts';
import { goldLabels, observedSummary, scoreEvaluation, type ScoringItem } from './evaluation';
import { uuid } from './fixtures.test-support';

const DIGEST = 'a'.repeat(64);
const itemId = (i: number) => i.toString(16).padStart(64, '0');
const noAssessment: Assessment = {
  status: 'unavailable',
  verdict: null,
  errors: ['not_assessed'],
  rationale: null,
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  concerns: [],
  model: null,
  promptVersion: null,
  costUsd: null,
  latencyMs: null,
};

function item(i: number, split: Split, recommendation: Decision['recommendation']): ScoringItem {
  const decision: Decision = {
    itemId: itemId(i),
    claimId: uuid(`claim-${String(i)}`),
    candidateId: uuid(`candidate-${String(i)}`),
    category: 'register_locality',
    policyVersion: 'elpa-verification-policy@1',
    strategy: 'A',
    recommendation,
    outcome: recommendation === 'auto_verify' ? 'not_eligible' : recommendation,
    reasons: [],
    evidenceScore: 4,
    assessmentUsed: false,
    eligibilityId: null,
  };
  return {
    itemId: itemId(i),
    split,
    category: 'register_locality',
    sourceKey: 'situr_accommodation_register',
    conditions: ['single_record'],
    decisions: {
      A: decision,
      B: { ...decision, strategy: 'B' },
      C: { ...decision, strategy: 'C' },
    },
    assessment: noAssessment,
    followUp: null,
  };
}

function review(reviewerId: string, ids: number[], wrong = new Set<number>()): Review {
  return {
    corpusDigest: DIGEST,
    reviewerId,
    reviewerKind: 'independent_human',
    independenceStatement: 'Labelled blind, without system outputs.',
    labels: ids.map((i) => ({
      itemId: itemId(i),
      label: wrong.has(i) ? 'contradicted' : 'supported',
      evidenceInspected: ['register'],
      rationale: 'checked',
      seconds: 30,
    })),
  };
}

describe('verification evaluation', () => {
  const items = [
    ...Array.from({ length: 120 }, (_, i) => item(i, 'calibration', 'auto_verify')),
    ...Array.from({ length: 130 }, (_, i) => item(1000 + i, 'holdout', 'auto_verify')),
  ];
  const calibrationIds = items.filter((i) => i.split === 'calibration').map((_, i) => i);
  const holdoutIds = items.filter((i) => i.split === 'holdout').map((_, i) => 1000 + i);

  it('reports missing independent labels instead of scores and keeps every gate closed', () => {
    const report = scoreEvaluation({ corpusDigest: DIGEST, items, reviews: [] });
    expect(report.status).toBe('independent_labels_missing');
    expect(report.gates.register_locality.passed).toBe(false);
    expect(report.gates.register_locality.reasons).toContain('insufficient_independent_reviewers');
    expect(report.gates.high_consequence.reasons).toContain('category_never_autonomous');
    expect(report.strategies.C.register_locality.holdout.precision.value).toBeNull();
  });

  it('requires adjudication of disagreements by someone other than the reviewers', () => {
    const gold = goldLabels(DIGEST, [review('r1', [1]), review('r2', [1], new Set([1]))]);
    expect(gold.unresolved).toEqual([itemId(1)]);
    const conflicted = goldLabels(DIGEST, [review('r1', [1]), review('r2', [1], new Set([1]))], {
      corpusDigest: DIGEST,
      adjudicatorId: 'r1',
      decisions: [{ itemId: itemId(1), label: 'supported', rationale: 'x' }],
    });
    expect(conflicted.errors).toContain('adjudicator_not_independent');
  });

  it('opens a gate only for enough double-reviewed, accurate holdout approvals', () => {
    const reviews = [
      review('r1', [...calibrationIds, ...holdoutIds]),
      review('r2', [...calibrationIds, ...holdoutIds]),
    ];
    const passing = scoreEvaluation({ corpusDigest: DIGEST, items, reviews });
    expect(passing.gates.register_locality).toEqual({ passed: true, threshold: 4, reasons: [] });
    expect(passing.strategies.C.register_locality.holdout.falseApprovals).toBe(0);

    const errors = new Set(holdoutIds.slice(0, 4));
    const failing = scoreEvaluation({
      corpusDigest: DIGEST,
      items,
      reviews: [
        review('r1', [...calibrationIds, ...holdoutIds], errors),
        review('r2', [...calibrationIds, ...holdoutIds], errors),
      ],
    });
    expect(failing.gates.register_locality.passed).toBe(false);
    expect(failing.gates.register_locality.reasons).toContain('false_approval_rate_above_gate');
  });

  it('summarizes recommendations without labels', () => {
    const summary = observedSummary(items);
    expect(summary.strategies.A.recommendations).toEqual({ auto_verify: 250 });
    expect(summary.verified).toBe(0);
  });
});
