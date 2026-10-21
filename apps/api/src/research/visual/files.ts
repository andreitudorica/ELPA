import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { privateDirectory } from '../extraction/files';
import { visualCorpusSchema } from './corpus';

export function imagePath(hash: string, preview = false): string {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid image fingerprint');
  return join(resolve('.data/visual/images'), `${hash}.${preview ? 'preview.png' : 'original'}`);
}

export async function storeImage(hash: string, original: Buffer, preview: Buffer) {
  if (sha256Hex(original) !== hash) throw new Error('Original fingerprint mismatch');
  await mkdir(privateDirectory(resolve('.data/visual/images')), { recursive: true, mode: 0o700 });
  for (const [path, data] of [
    [imagePath(hash), original],
    [imagePath(hash, true), preview],
  ] as const) {
    try {
      await writeFile(path, data, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      if (sha256Hex(await readFile(path)) !== sha256Hex(data))
        throw new Error('Retained image differs from pinned bytes', { cause: error });
    }
  }
}

export async function readVisualCorpus(path: string) {
  privateDirectory(path);
  const corpus = visualCorpusSchema.parse(
    JSON.parse(await readFile(join(path, 'corpus.private.json'), 'utf8')),
  );
  const manifest: unknown = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'));
  if (sha256Hex(canonicalJson(manifest)) !== corpus.manifestSha256)
    throw new Error('Visual manifest checksum mismatch');
  const pinned = z
    .object({
      campaignId: z.string(),
      items: z.array(
        z.object({
          sourceRecordKey: z.string(),
          imageKey: z.string(),
          imageSha256: z.string(),
          entrySha256: z.string(),
          sourceVersion: z.string(),
          group: z.string(),
          partition: z.string(),
        }),
      ),
    })
    .parse(manifest);
  if (pinned.campaignId !== corpus.campaignId || pinned.items.length !== corpus.entries.length)
    throw new Error('Visual selection mismatch');
  const groups = new Map<string, string>();
  const ids = new Set<string>();
  for (const entry of corpus.entries) {
    const item = pinned.items.find((item) => item.sourceRecordKey === entry.sourceRecordKey);
    if (
      item?.imageKey !== entry.image.title ||
      item.imageSha256 !== entry.image.sha256 ||
      item.entrySha256 !== sha256Hex(canonicalJson(entry)) ||
      item.sourceVersion !== entry.image.sourceVersion ||
      item.group !== entry.group ||
      item.partition !== entry.partition
    )
      throw new Error('Image differs from sealed selection');
    if (ids.has(entry.evidenceId)) throw new Error('Duplicate image Evidence');
    ids.add(entry.evidenceId);
    if (groups.has(entry.group) && groups.get(entry.group) !== entry.partition)
      throw new Error('Visual partition leakage');
    groups.set(entry.group, entry.partition);
    if (
      sha256Hex(await readFile(imagePath(entry.image.sha256))) !== entry.image.sha256 ||
      sha256Hex(await readFile(imagePath(entry.image.sha256, true))) !== entry.image.previewSha256
    )
      throw new Error('Retained image fingerprint mismatch');
  }
  return corpus;
}
