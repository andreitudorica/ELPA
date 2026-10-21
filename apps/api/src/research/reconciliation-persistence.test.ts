import { expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from './acquisition/source-record';
import { persistReconciliation } from './reconciliation-persistence';
import { reconcile } from './reconciliation/engine';
import { item, proposition, uuid } from './reconciliation/fixtures';

it('appends audited idempotent assessments and retains prior inputs after a new Claim', async () => {
  const input = item([proposition()]),
    before = canonicalJson(input),
    stored = new Map<string, string>(),
    events: string[] = [];
  const ports = {
    transaction: async <T>(work: () => Promise<T>) => {
      events.push('begin');
      const result = await work();
      events.push('commit');
      return result;
    },
    store: (c: typeof input, r: ReturnType<typeof reconcile>) => {
      if (stored.has(r.inputDigest)) return Promise.resolve(null);
      stored.set(r.inputDigest, canonicalJson({ c, r }));
      events.push('insert');
      return Promise.resolve(uuid(stored.size));
    },
    audit: () => {
      events.push('audit');
      return Promise.resolve();
    },
  };
  const run = (cases: (typeof input)[]) =>
    persistReconciliation(
      {
        campaignId: uuid(900),
        administratorId: uuid(901),
        corpusDigest: sha256Hex('corpus'),
        cases,
        results: cases.map((c) => reconcile(c, '2026-10-22T00:00:00.000Z')),
      },
      ports,
    );
  expect(await run([input])).toBe(1);
  expect(await run([input])).toBe(0);
  const historical = stored.values().next().value;
  expect(
    await run([
      { ...input, propositions: [...input.propositions, proposition(2, { value: false })] },
    ]),
  ).toBe(1);
  expect(stored.size).toBe(2);
  expect(stored.values().next().value).toBe(historical);
  expect(canonicalJson(input)).toBe(before);
  expect(events.slice(0, 4)).toEqual(['begin', 'insert', 'audit', 'commit']);
});
