import { describe, expect, it } from 'vitest';

import { allocate, drawSample, splitOf, type FrameItem } from './sampling';

const frame = (n: number, overrides: Partial<FrameItem> = {}): FrameItem[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `claim-${String(i)}`,
    category: 'register_locality',
    stratum: 'single_record',
    group: `group-${String(i)}`,
    prior: null,
    ...overrides,
  }));

describe('verification sampling', () => {
  it('keeps earlier holdout items out of development and calibration', () => {
    for (let i = 0; i < 200; i++) expect(splitOf(`g${String(i)}`, 'holdout')).toBe('holdout');
    for (let i = 0; i < 200; i++)
      expect(splitOf(`g${String(i)}`, 'development')).not.toBe('holdout');
  });

  it('is deterministic, honours stratum caps and takes one item per group', () => {
    const input = [
      ...frame(3000),
      ...frame(3000).map((item, i) => ({ ...item, key: `dup-${String(i)}` })),
      ...frame(400, { stratum: 'conditional_conflict' }).map((item, i) => ({
        ...item,
        key: `c-${String(i)}`,
        group: `cg-${String(i)}`,
      })),
    ];
    const first = drawSample(input);
    expect(drawSample(input).items).toEqual(first.items);
    const holdout = first.items.filter((i) => i.split === 'holdout');
    // The empty agreement stratum's share moves to the others: the full quota is drawn.
    expect(holdout).toHaveLength(125);
    expect(holdout.filter((i) => i.stratum === 'conditional_conflict')).toHaveLength(36);
    expect(holdout.filter((i) => i.stratum === 'single_record')).toHaveLength(89);
    const groups = first.items.map((i) => `${i.category}:${i.group}`);
    expect(new Set(groups).size).toBe(groups.length);
    const sampled = holdout.find((i) => i.stratum === 'single_record');
    expect(sampled?.weight).toBeCloseTo(6000 / 89, 6);
  });

  it('redistributes quota from strata that cannot fill their share', () => {
    expect(allocate(10, { a: 0.5, b: 0.5 }, (s) => (s === 'a' ? 2 : 100))).toEqual({ a: 2, b: 8 });
    expect(allocate(10, { a: 0.2, b: 0.8 }, () => 100)).toEqual({ a: 2, b: 8 });
    expect(allocate(10, { a: 0.5, b: 0.5 }, () => 3)).toEqual({ a: 3, b: 3 });
  });
});
