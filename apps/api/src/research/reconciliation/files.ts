import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { privateDirectory } from '../extraction/files';
import { corpusSchema } from './contracts';

export async function writePrivate(
  directory: string,
  name: string,
  value: unknown,
  exclusive = false,
) {
  await mkdir(privateDirectory(directory), { recursive: true, mode: 0o700 });
  await writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    flag: exclusive ? 'wx' : 'w',
  });
}

export async function readReconciliationCorpus(directory: string) {
  const corpus = corpusSchema.parse(
    JSON.parse(await readFile(join(directory, 'corpus.private.json'), 'utf8')),
  );
  const manifest: unknown = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const digest = sha256Hex(canonicalJson(corpus));
  if (canonicalJson(manifest) !== canonicalJson(publicManifest(corpus)))
    throw new Error('Reconciliation corpus manifest mismatch');
  const groups = new Map<string, string>();
  const lineagePartitions = new Map<string, string>();
  const claimIds = new Set<string>();
  for (const item of corpus.cases) {
    if (groups.has(item.group) && groups.get(item.group) !== item.partition)
      throw new Error('Corpus leakage');
    groups.set(item.group, item.partition);
    for (const proposition of item.propositions) {
      if (claimIds.has(proposition.claimId)) throw new Error('Duplicate corpus Claim');
      claimIds.add(proposition.claimId);
      for (const key of [
        proposition.candidateId,
        proposition.evidenceId,
        proposition.evidence.originalId,
        proposition.evidence.contentSha256,
        ...(proposition.evidence.passageFingerprint === null
          ? []
          : [proposition.evidence.passageFingerprint]),
      ]) {
        if (lineagePartitions.has(key) && lineagePartitions.get(key) !== item.partition)
          throw new Error('Corpus lineage leakage');
        lineagePartitions.set(key, item.partition);
      }
    }
  }
  if (new Set(corpus.cases.map((c) => c.id)).size !== corpus.cases.length)
    throw new Error('Duplicate corpus case');
  return { corpus, digest };
}

export function publicManifest(corpus: ReturnType<typeof corpusSchema.parse>) {
  return {
    version: corpus.version,
    campaignId: corpus.campaignId,
    asOf: corpus.asOf,
    frameDigest: corpus.frameDigest,
    corpusDigest: sha256Hex(canonicalJson(corpus)),
    cases: corpus.cases.map((c) => ({
      id: c.id,
      group: c.group,
      partition: c.partition,
      stratum: c.stratum,
      candidateIds: c.candidateIds,
      claimIds: c.propositions.map((p) => p.claimId),
      evidenceIds: [...new Set(c.propositions.map((p) => p.evidenceId))],
    })),
  };
}
