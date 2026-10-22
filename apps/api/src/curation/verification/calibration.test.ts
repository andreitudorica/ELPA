import { describe, expect, it } from 'vitest';

import {
  binomialCdf,
  clopperPearsonUpper,
  conformalThreshold,
  proportionInterval,
  reliability,
  riskCoverage,
  selectThreshold,
  type ScoredOutcome,
} from './calibration';

const outcomes = (score: number, correct: number, wrong: number): ScoredOutcome[] => [
  ...Array.from({ length: correct }, () => ({ score, proposed: true, correct: true })),
  ...Array.from({ length: wrong }, () => ({ score, proposed: true, correct: false })),
];

describe('calibration statistics', () => {
  it('matches known binomial and exact-bound values', () => {
    expect(binomialCdf(0, 10, 0.5)).toBeCloseTo(1 / 1024, 6);
    // Zero failures in 100 trials: the "rule of three" neighbourhood, exactly 1 − 0.05^(1/100).
    expect(clopperPearsonUpper(0, 100)).toBeCloseTo(1 - 0.05 ** (1 / 100), 3);
    expect(clopperPearsonUpper(0, 0)).toBeNull();
    const interval = proportionInterval(5, 10).interval;
    expect(interval?.[0]).toBeCloseTo(0.187, 2);
    expect(interval?.[1]).toBeCloseTo(0.813, 2);
  });

  it('selects the lowest threshold whose calibration error bound meets the target', () => {
    const items = [...outcomes(4, 150, 0), ...outcomes(3, 40, 10)];
    const points = riskCoverage(items);
    expect(points.map((p) => p.threshold)).toEqual([4, 3]);
    const selected = selectThreshold(points, { maxPoint: 0.02, maxUpper: 0.05 });
    expect(selected?.threshold).toBe(4);
    expect(
      selectThreshold(riskCoverage(outcomes(4, 20, 0)), { maxPoint: 0.02, maxUpper: 0.05 }),
    ).toBeNull();
  });

  it('controls marginal false-approval risk conformally', () => {
    const items = [...outcomes(4, 90, 0), ...outcomes(2, 5, 5)];
    expect(conformalThreshold(items, 0.05)?.threshold).toBe(4);
    expect(conformalThreshold(outcomes(4, 5, 0), 0.05)).toBeNull();
  });

  it('reports calibration error only for adequately populated bins', () => {
    const calibration = [...outcomes(4, 19, 1), ...outcomes(2, 2, 1)];
    const holdout = outcomes(4, 9, 1);
    const result = reliability(calibration, holdout);
    expect(result.bins).toEqual([{ score: 4, predicted: 0.95, observed: 0.9, n: 10 }]);
    expect(result.expectedCalibrationError).toBeCloseTo(0.05, 4);
    expect(reliability(calibration, []).expectedCalibrationError).toBeNull();
  });
});
