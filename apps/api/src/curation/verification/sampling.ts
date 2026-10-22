import { createHash } from 'node:crypto';

import { CATEGORY_IDS, SEED, SPLITS, type CategoryId, type Split } from './contracts';

export interface FrameItem {
  key: string;
  category: CategoryId;
  stratum: string;
  /** Leakage group: related records always share one split. */
  group: string;
  /** Partition of the same record in an earlier experiment, if any. */
  prior: 'development' | 'holdout' | null;
}

export const QUOTAS: Record<CategoryId, Record<Split, number>> = {
  register_locality: { development: 20, calibration: 100, holdout: 125 },
  osm_county: { development: 20, calibration: 100, holdout: 125 },
  register_classified_capacity: { development: 20, calibration: 100, holdout: 125 },
  explicit_text_facility: { development: 30, calibration: 30, holdout: 30 },
  property_shape_count: { development: 6, calibration: 20, holdout: 20 },
  high_consequence: { development: 6, calibration: 15, holdout: 20 },
};

/** Target share of each split's quota per stratum; hard conditions are oversampled. */
export const STRATUM_SHARES: Record<CategoryId, Record<string, number>> = {
  register_locality: { conditional_conflict: 0.2, conditional_agreement: 0.3, single_record: 0.5 },
  osm_county: { conditional_conflict: 0.2, conditional_agreement: 0.3, single_record: 0.5 },
  register_classified_capacity: { reprocessed_copy: 0.1, has_counterpart: 0.3, single_record: 0.6 },
  explicit_text_facility: { current: 0.5, superseded: 0.5 },
  property_shape_count: { structured_tag: 0.7, text_span: 0.3 },
  high_consequence: { text_capacity: 0.4, structured_capacity: 0.6 },
};

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export function splitOf(group: string, prior: FrameItem['prior']): Split {
  if (prior === 'holdout') return 'holdout';
  const bucket = Number.parseInt(digest(`${SEED}:split:${group}`).slice(0, 8), 16) / 2 ** 32;
  // Items already inspected in an earlier experiment never enter this holdout.
  if (prior === 'development') return bucket < 0.25 ? 'development' : 'calibration';
  return bucket < 0.12 ? 'development' : bucket < 0.5 ? 'calibration' : 'holdout';
}

/**
 * Integer quota per stratum, proportional to its share; quota a stratum cannot
 * fill (too few available groups) goes to the strata that still can.
 */
export function allocate(
  quota: number,
  shares: Record<string, number>,
  available: (stratum: string) => number,
): Record<string, number> {
  const strata = Object.keys(shares).sort();
  const caps: Record<string, number> = Object.fromEntries(strata.map((s) => [s, 0]));
  // Highest-averages (D'Hondt) apportionment: proportional to share among fillable strata.
  for (let assigned = 0; assigned < quota; assigned++) {
    let best: string | null = null;
    let bestPriority = 0;
    for (const stratum of strata) {
      const cap = caps[stratum] ?? 0;
      if (cap >= available(stratum)) continue;
      const priority = (shares[stratum] ?? 0) / (cap + 1);
      if (priority > bestPriority) {
        best = stratum;
        bestPriority = priority;
      }
    }
    if (best === null) break;
    caps[best] = (caps[best] ?? 0) + 1;
  }
  return caps;
}

export function drawSample(frame: readonly FrameItem[]) {
  const population = new Map<string, number>();
  for (const item of frame) {
    const key = `${item.category}:${item.stratum}`;
    population.set(key, (population.get(key) ?? 0) + 1);
  }
  const ranked = frame
    .map((item) => ({
      ...item,
      split: splitOf(item.group, item.prior),
      rank: digest(`${SEED}:rank:${item.group}:${item.key}`),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank));
  const available = new Map<string, Set<string>>();
  for (const item of ranked) {
    const slot = `${item.category}:${item.stratum}:${item.split}`;
    available.set(slot, (available.get(slot) ?? new Set()).add(item.group));
  }
  const caps = new Map<string, number>();
  for (const category of CATEGORY_IDS)
    for (const split of SPLITS) {
      const allocation = allocate(
        QUOTAS[category][split],
        STRATUM_SHARES[category],
        (stratum) => available.get(`${category}:${stratum}:${split}`)?.size ?? 0,
      );
      for (const [stratum, cap] of Object.entries(allocation))
        caps.set(`${category}:${stratum}:${split}`, cap);
    }
  const taken = new Map<string, number>();
  const groupsTaken = new Set<string>();
  const selected: (FrameItem & { split: Split })[] = [];
  for (const item of ranked) {
    // At most one item per leakage group and category.
    const groupKey = `${item.category}:${item.group}`;
    if (groupsTaken.has(groupKey)) continue;
    const slot = `${item.category}:${item.stratum}:${item.split}`;
    const cap = caps.get(slot) ?? 0;
    const count = taken.get(slot) ?? 0;
    if (count >= cap) continue;
    taken.set(slot, count + 1);
    groupsTaken.add(groupKey);
    selected.push({
      key: item.key,
      category: item.category,
      stratum: item.stratum,
      group: item.group,
      prior: item.prior,
      split: item.split,
    });
  }
  const items = selected.map((item) => ({
    ...item,
    weight:
      (population.get(`${item.category}:${item.stratum}`) ?? 0) /
      (taken.get(`${item.category}:${item.stratum}:${item.split}`) ?? 1),
  }));
  const summary = Object.fromEntries(
    CATEGORY_IDS.map((category) => [
      category,
      {
        quota: QUOTAS[category],
        strata: Object.fromEntries(
          Object.keys(STRATUM_SHARES[category]).map((stratum) => [
            stratum,
            {
              population: population.get(`${category}:${stratum}`) ?? 0,
              ...Object.fromEntries(
                SPLITS.map((split) => [split, taken.get(`${category}:${stratum}:${split}`) ?? 0]),
              ),
            },
          ]),
        ),
        unstratified: frame.filter(
          (i) => i.category === category && STRATUM_SHARES[category][i.stratum] === undefined,
        ).length,
      },
    ]),
  );
  return { items, summary };
}
