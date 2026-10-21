import { expect, it } from 'vitest';

import { sha256Hex } from '../acquisition/source-record';
import { sampleGroups, type FrameEntry } from './corpus';
import { uuid } from './fixtures';

function frame(n: number): FrameEntry {
  return {
    candidateId: uuid(n),
    sourceKey: 'osm_geofabrik_romania',
    sourceRecordKey: `synthetic-${String(n)}`,
    countyCode: 'RO-AB',
    claimId: uuid(n + 100),
    evidenceId: uuid(n + 200),
    target: 'offer.pool',
    method: 'fixture',
    evidenceSha256: sha256Hex(String(n)),
    description: null,
  };
}
it('stratifies deterministically with no related property or copied content across partitions', () => {
  const rows = Array.from({ length: 24 }, (_, i) => frame(i + 1));
  const a = rows[0],
    b = rows[1],
    c = rows[2],
    d = rows[3];
  if (a === undefined || b === undefined || c === undefined || d === undefined)
    throw new Error('fixture');
  const text = 'Synthetic long description '.repeat(6);
  c.description = text;
  d.description = text;
  const members = rows.map((r) => ({
    id: r.candidateId,
    sourceKey: r.sourceKey,
    sourceRecordKey: r.sourceRecordKey,
  }));
  const sampled = sampleGroups(rows, members, [
    { left: a.candidateId, right: b.candidateId, relation: 'same_property' },
  ]);
  expect(sampled.summary.leakageGroups).toBe(22);
  expect(
    sampled.selected.some(
      (g) => g.candidateIds.includes(a.candidateId) && g.candidateIds.includes(b.candidateId),
    ),
  ).toBe(true);
  expect(
    sampled.selected.some(
      (g) => g.candidateIds.includes(c.candidateId) && g.candidateIds.includes(d.candidateId),
    ),
  ).toBe(true);
  expect(
    sampleGroups(rows, members, [
      { left: a.candidateId, right: b.candidateId, relation: 'same_property' },
    ]),
  ).toEqual(sampled);
});
it('records over-bound exclusions explicitly', () => {
  const rows = Array.from({ length: 201 }, (_, i) => ({
    ...frame(i + 1),
    candidateId: uuid(500),
    sourceRecordKey: 'one',
    evidenceSha256: sha256Hex('one'),
  }));
  const result = sampleGroups(rows, [], []);
  expect(result.summary.exclusions).toHaveLength(1);
  expect(result.selected).toHaveLength(0);
});
