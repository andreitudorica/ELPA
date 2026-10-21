import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { sha256Hex } from '../acquisition/source-record';
import { CORPUS_VERSION, resultSchema, type ReconciliationCorpus } from './contracts';
import { reconcile } from './engine';
import { item, proposition, uuid } from './fixtures';
import { publicManifest, readReconciliationCorpus, writePrivate } from './files';

it('pins private artifacts, refuses overwrite and detects edited input', async () => {
  const root = resolve('.data');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'reconciliation-test-'));
  const corpus: ReconciliationCorpus = {
    version: CORPUS_VERSION,
    campaignId: uuid(900),
    asOf: '2026-10-22T00:00:00Z',
    frameDigest: sha256Hex('frame'),
    cases: [item([proposition()])],
    evidenceSnapshots: [],
  };
  try {
    await writePrivate(dir, 'corpus.private.json', corpus, true);
    await writePrivate(dir, 'manifest.json', publicManifest(corpus), true);
    expect((await readReconciliationCorpus(dir)).corpus).toEqual(corpus);
    expect((await stat(join(dir, 'corpus.private.json'))).mode & 0o777).toBe(0o600);
    await expect(writePrivate(dir, 'corpus.private.json', corpus, true)).rejects.toThrow();
    const leakingCase = item([proposition(2, { evidenceId: uuid(201) })]);
    leakingCase.id = sha256Hex('other-case');
    leakingCase.group = sha256Hex('other-group');
    leakingCase.partition = 'development';
    const leaking = { ...corpus, cases: [...corpus.cases, leakingCase] };
    await writePrivate(dir, 'corpus.private.json', leaking);
    await writePrivate(dir, 'manifest.json', publicManifest(leaking));
    await expect(readReconciliationCorpus(dir)).rejects.toThrow('lineage leakage');
    await writePrivate(dir, 'corpus.private.json', corpus);
    await writePrivate(dir, 'manifest.json', publicManifest(corpus));
    const edited: unknown = JSON.parse(await readFile(join(dir, 'corpus.private.json'), 'utf8'));
    expect(edited).toEqual(corpus);
    await writePrivate(dir, 'corpus.private.json', { ...corpus, asOf: '2027-10-22T00:00:00Z' });
    await expect(readReconciliationCorpus(dir)).rejects.toThrow('manifest mismatch');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it('rejects verification/publication statuses and writes outside private research storage', async () => {
  const result = reconcile(item([proposition()]), '2026-10-22T00:00:00Z');
  expect(() => resultSchema.parse({ ...result, status: 'verified' })).toThrow();
  expect(() => resultSchema.parse({ ...result, status: 'published' })).toThrow();
  await expect(
    writePrivate('/private/tmp/reconciliation-disallowed', 'input.json', {}),
  ).rejects.toThrow('below apps/api/.data');
});
