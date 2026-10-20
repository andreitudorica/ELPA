/** Statistics used to report evaluation results with their uncertainty. */

export interface Proportion {
  successes: number;
  trials: number;
  /** Point estimate, or null when there are no trials. */
  value: number | null;
  /** Wilson score interval at 95 % confidence. */
  interval: [number, number] | null;
}

const Z_95 = 1.959963984540054;

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function proportion(successes: number, trials: number): Proportion {
  if (trials === 0) return { successes, trials, value: null, interval: null };
  const p = successes / trials;
  const z2 = Z_95 * Z_95;
  const centre = (p + z2 / (2 * trials)) / (1 + z2 / trials);
  const margin =
    (Z_95 * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / (1 + z2 / trials);
  return {
    successes,
    trials,
    value: round(p),
    interval: [round(Math.max(0, centre - margin)), round(Math.min(1, centre + margin))],
  };
}

export function f1(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null || precision + recall === 0) return null;
  return round((2 * precision * recall) / (precision + recall));
}

/** Cohen's kappa for two reviewers labelling the same items. */
export function cohensKappa(pairs: readonly [string, string][]): number | null {
  if (pairs.length === 0) return null;
  const labels = [...new Set(pairs.flat())];
  const observed = pairs.filter(([left, right]) => left === right).length / pairs.length;
  const expected = labels.reduce((sum, label) => {
    const left = pairs.filter(([value]) => value === label).length / pairs.length;
    const right = pairs.filter(([, value]) => value === label).length / pairs.length;
    return sum + left * right;
  }, 0);
  return expected === 1 ? 1 : round((observed - expected) / (1 - expected));
}
