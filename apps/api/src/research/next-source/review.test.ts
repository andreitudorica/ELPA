import { expect, it } from 'vitest';

import { scoreIncrementalReview } from './review';

const predictions = [
  {
    sourceRecordKey: 'synthetic',
    partition: 'evaluation',
    classification: 'apparent_discovery_unreviewed',
  },
];
const label = {
  source_record_key: 'synthetic',
  reviewer_id: 'r1',
  reviewer_type: 'independent_human',
  reviewed_at: '2026-10-21T08:00:00Z',
  discovery_decision: 'new_in_scope',
  evidence_urls: 'https://synthetic.example',
  evidence_locator: 'source-field',
};

it('leaves uncertainty undefined without independent labels', () => {
  expect(scoreIncrementalReview(predictions, []).discoveryPrecision).toMatchObject({
    trials: 0,
    value: null,
    interval: null,
  });
  expect(
    scoreIncrementalReview(predictions, [{ ...label, reviewer_type: 'developer' }]),
  ).toMatchObject({
    nonIndependentLabels: 1,
    resolvedDoubleReviewed: 0,
    h1GatePassed: false,
  });
});

it('reports disagreement and excludes single-reviewer decisions', () => {
  expect(scoreIncrementalReview(predictions, [label]).singleReviewer).toBe(1);
  const result = scoreIncrementalReview(predictions, [
    label,
    { ...label, reviewer_id: 'r2', discovery_decision: 'existing' },
  ]);
  expect(result).toMatchObject({ disputed: 1, resolvedDoubleReviewed: 0 });
});

it('scores concordant reviews with an interval and rejects tuning contamination', () => {
  const result = scoreIncrementalReview(predictions, [label, { ...label, reviewer_id: 'r2' }]);
  expect(result.discoveryPrecision).toMatchObject({ successes: 1, trials: 1, value: 1 });
  expect(result.discoveryPrecision.interval?.[0]).toBeLessThan(0.5);
  expect(() => scoreIncrementalReview([], [label])).toThrow('not in the frozen holdout');
  expect(() => scoreIncrementalReview(predictions, [label, label])).toThrow('Duplicate label');
});
