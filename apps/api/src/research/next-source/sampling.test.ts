import { expect, it } from 'vitest';

import { sampleOvertureFrame } from './sampling';

function syntheticOvertureRow(id = '0198c5d2-8b7a-7000-8000-000000000101') {
  return {
    id,
    version: 1,
    names: { primary: 'Synthetic' },
    bbox: { xmin: 23.1, xmax: 23.1, ymin: 46.7, ymax: 46.7 },
    addresses: [{ country: 'RO', region: 'Cluj', locality: 'Synthetic Village' }],
    taxonomy: { primary: 'cabin', hierarchy: ['lodging', 'cabin'] },
    sources: [{ dataset: 'meta', license: 'CDLA-Permissive-2.0' }],
    websites: ['https://synthetic.example'],
    socials: null,
    confidence: 0.9,
    operating_status: 'open',
  };
}

it('bounds the sample, preserves frame sizes, and is independent of input order', () => {
  const rows = Array.from({ length: 12 }, (_, index) =>
    syntheticOvertureRow(`0198c5d2-8b7a-7000-8000-${String(index).padStart(12, '0')}`),
  );
  const first = sampleOvertureFrame(rows);
  expect(first.records).toHaveLength(2);
  expect(first.manifest.strata['RO-CJ|other_or_unknown|dwelling_hint|web_present']).toEqual({
    population: 12,
    sampled: 2,
    inclusionProbability: 2 / 12,
  });
  expect(sampleOvertureFrame([...rows].reverse()).records).toEqual(first.records);
  expect(
    first.manifest.items.every((item) => ['evaluation', 'tuning'].includes(item.partition)),
  ).toBe(true);
});

it('counts exclusions and refuses duplicate frame ids without replacement', () => {
  const row = syntheticOvertureRow();
  const result = sampleOvertureFrame([
    { ...row, sources: [{ dataset: 'unknown', license: null }] },
  ]);
  expect(result.manifest.excluded).toEqual({ unapproved_licence: 1 });
  expect(result.records).toEqual([]);
  expect(() => sampleOvertureFrame([row, row])).toThrow('Duplicate frame id');
});
