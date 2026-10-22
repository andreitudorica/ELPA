/**
 * Selective-prediction statistics over an ordinal evidence score. Scores are
 * not probabilities; empirical correctness comes only from independent labels.
 */

export interface ScoredOutcome {
  score: number;
  /** Policy proposed automatic verification (before the gate). */
  proposed: boolean;
  /** Independent gold label says the proposition is supported. */
  correct: boolean;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/** P(X ≤ k) for X ~ Binomial(n, p), summed in log space. */
export function binomialCdf(k: number, n: number, p: number): number {
  if (k >= n) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return 0;
  let logChoose = 0;
  let total = 0;
  for (let i = 0; i <= k; i++) {
    if (i > 0) logChoose += Math.log(n - i + 1) - Math.log(i);
    total += Math.exp(logChoose + i * Math.log(p) + (n - i) * Math.log(1 - p));
  }
  return Math.min(1, total);
}

/** One-sided exact (Clopper–Pearson) upper bound on an error rate. */
export function clopperPearsonUpper(errors: number, trials: number, alpha = 0.05): number | null {
  if (trials === 0) return null;
  if (errors >= trials) return 1;
  let low = errors / trials,
    high = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (binomialCdf(errors, trials, mid) > alpha) low = mid;
    else high = mid;
  }
  return round(high);
}

/** Exact two-sided 95 % interval for a proportion; null without trials. */
export function proportionInterval(successes: number, trials: number) {
  if (trials === 0) return { successes, trials, value: null, interval: null };
  const bound = (test: (p: number) => boolean) => {
    let low = 0,
      high = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (test(mid)) low = mid;
      else high = mid;
    }
    return round((low + high) / 2);
  };
  const lower =
    successes === 0 ? 0 : bound((p) => 1 - binomialCdf(successes - 1, trials, p) < 0.025);
  const upper = successes === trials ? 1 : bound((p) => binomialCdf(successes, trials, p) > 0.025);
  return {
    successes,
    trials,
    value: round(successes / trials),
    interval: [lower, upper] as [number, number],
  };
}

export interface RiskPoint {
  threshold: number;
  accepted: number;
  falseApprovals: number;
  coverage: number;
  risk: number | null;
  riskUpper: number | null;
}

/** Accepting proposed items with score ≥ t, for every observed t (strictest first). */
export function riskCoverage(items: readonly ScoredOutcome[]): RiskPoint[] {
  const thresholds = [...new Set(items.filter((i) => i.proposed).map((i) => i.score))].sort(
    (a, b) => b - a,
  );
  return thresholds.map((threshold) => {
    const accepted = items.filter((i) => i.proposed && i.score >= threshold);
    const falseApprovals = accepted.filter((i) => !i.correct).length;
    return {
      threshold,
      accepted: accepted.length,
      falseApprovals,
      coverage: items.length === 0 ? 0 : round(accepted.length / items.length),
      risk: accepted.length === 0 ? null : round(falseApprovals / accepted.length),
      riskUpper: clopperPearsonUpper(falseApprovals, accepted.length),
    };
  });
}

/** Lowest threshold (most coverage) whose calibration error bound meets the target. */
export function selectThreshold(
  points: readonly RiskPoint[],
  target: { maxPoint: number; maxUpper: number },
): RiskPoint | null {
  const passing = points.filter(
    (p) =>
      p.risk !== null &&
      p.riskUpper !== null &&
      p.risk <= target.maxPoint &&
      p.riskUpper <= target.maxUpper,
  );
  return passing.sort((a, b) => a.threshold - b.threshold)[0] ?? null;
}

/**
 * Conformal risk control for the marginal false-approval rate
 * E[1{accepted ∧ wrong}]: smallest threshold with (Σ loss + 1)/(n + 1) ≤ α.
 */
export function conformalThreshold(
  items: readonly ScoredOutcome[],
  alpha: number,
): { threshold: number; bound: number } | null {
  const n = items.length;
  if (n === 0) return null;
  const candidates = [...new Set(items.map((i) => i.score))].sort((a, b) => a - b);
  for (const threshold of candidates) {
    const loss = items.filter((i) => i.proposed && i.score >= threshold && !i.correct).length;
    const bound = (loss + 1) / (n + 1);
    if (bound <= alpha) return { threshold, bound: round(bound) };
  }
  return null;
}

export interface ReliabilityBin {
  score: number;
  predicted: number;
  observed: number | null;
  n: number;
}

/**
 * Histogram-binning calibration: the calibration split's precision per score
 * becomes the predicted correctness on the held-out split.
 */
export function reliability(
  calibration: readonly ScoredOutcome[],
  holdout: readonly ScoredOutcome[],
  minBinSize = 10,
): { bins: ReliabilityBin[]; expectedCalibrationError: number | null } {
  const scores = [...new Set(calibration.filter((i) => i.proposed).map((i) => i.score))].sort();
  const bins: ReliabilityBin[] = [];
  for (const score of scores) {
    const fitted = calibration.filter((i) => i.proposed && i.score === score);
    if (fitted.length < minBinSize) continue;
    const held = holdout.filter((i) => i.proposed && i.score === score);
    bins.push({
      score,
      predicted: round(fitted.filter((i) => i.correct).length / fitted.length),
      observed:
        held.length === 0 ? null : round(held.filter((i) => i.correct).length / held.length),
      n: held.length,
    });
  }
  const total = bins.reduce((sum, b) => sum + b.n, 0);
  return {
    bins,
    expectedCalibrationError:
      total === 0
        ? null
        : round(
            bins.reduce(
              (sum, b) =>
                sum +
                (b.observed === null ? 0 : (b.n / total) * Math.abs(b.observed - b.predicted)),
              0,
            ),
          ),
  };
}
