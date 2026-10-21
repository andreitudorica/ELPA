import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { corpusSchema } from './corpus';
import type { Corpus } from './corpus';
import { verifyDocument } from './documents';

export function privateDirectory(path: string): string {
  const directory = resolve(path);
  const within = relative(resolve('.data'), directory);
  if (within === '' || within.startsWith('..') || isAbsolute(within))
    throw new Error('Write private extraction artifacts below apps/api/.data/');
  return directory;
}

export async function writeJson(directory: string, name: string, value: unknown): Promise<void> {
  await mkdir(privateDirectory(directory), { recursive: true });
  await writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`);
}

export async function readCorpus(directory: string): Promise<Corpus> {
  const corpus = corpusSchema.parse(
    JSON.parse(await readFile(join(directory, 'corpus.private.json'), 'utf8')),
  );
  const manifest: unknown = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (sha256Hex(canonicalJson(manifest)) !== corpus.manifestSha256)
    throw new Error('Corpus manifest checksum mismatch');
  const pinned = z
    .object({
      campaignId: z.string(),
      items: z.array(
        z.object({
          documentId: z.string(),
          textSha256: z.string(),
          evidenceSha256: z.string(),
          group: z.string(),
          partition: z.string(),
        }),
      ),
    })
    .parse(manifest);
  if (pinned.campaignId !== corpus.campaignId || pinned.items.length !== corpus.entries.length)
    throw new Error('Corpus selection mismatch');
  const items = new Map(pinned.items.map((item) => [item.documentId, item]));
  if (corpus.entries.some((entry) => !verifyDocument(entry.document)))
    throw new Error('Corpus document checksum mismatch');
  const partitions = new Map<string, string>();
  const ids = new Set<string>();
  for (const entry of corpus.entries) {
    const pinnedItem = items.get(entry.document.id);
    if (
      pinnedItem?.textSha256 !== entry.document.textSha256 ||
      pinnedItem.evidenceSha256 !== entry.document.evidenceSha256 ||
      pinnedItem.group !== entry.group ||
      pinnedItem.partition !== entry.partition
    )
      throw new Error('Document differs from sealed selection');
    if (ids.has(entry.document.id)) throw new Error('Duplicate corpus document');
    ids.add(entry.document.id);
    if (partitions.has(entry.group) && partitions.get(entry.group) !== entry.partition)
      throw new Error('Corpus partition leakage');
    partitions.set(entry.group, entry.partition);
  }
  return corpus;
}
