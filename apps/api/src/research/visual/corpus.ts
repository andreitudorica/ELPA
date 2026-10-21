import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { UnionFind } from '../grouping/union-find';
import { imageEntrySchema } from './contracts';
import type { VisualEntry } from './contracts';
import { hammingDistance } from './integrity';

export const VISUAL_CORPUS_VERSION = 'grp-visual-corpus@1';
export const VISUAL_SEED = 'elpa-visual-primary-2026-10';
export const visualCorpusSchema = z
  .object({
    version: z.literal(VISUAL_CORPUS_VERSION),
    campaignId: z.uuid(),
    entries: z.array(imageEntrySchema).max(3),
    manifestSha256: z.string(),
  })
  .strict();
export type VisualCorpus = z.infer<typeof visualCorpusSchema>;

/** Existing matcher links and image similarity bound leakage, never establish ownership. */
export function partitionImages(
  entries: Omit<VisualEntry, 'group' | 'partition'>[],
  members: { id: string; sourceKey: string; sourceRecordKey: string }[],
  edges: { left: string; right: string; relation: string }[],
) {
  const related = new UnionFind();
  const stable = new Map(
    members.map((member) => [member.id, `${member.sourceKey}:${member.sourceRecordKey}`]),
  );
  for (const edge of edges)
    if (edge.relation === 'same_property')
      related.union(stable.get(edge.left) ?? edge.left, stable.get(edge.right) ?? edge.right);
  const identity = (entry: (typeof entries)[number]) =>
    stable.get(entry.candidateId) ?? entry.sourceRecordKey;
  let exactDuplicates = 0;
  let nearDuplicatePairs = 0;
  for (const [i, left] of entries.entries())
    for (const right of entries.slice(i + 1)) {
      if (left.image.sha256 === right.image.sha256) {
        related.union(identity(left), identity(right));
        exactDuplicates += 1;
      } else if (hammingDistance(left.image.dHash, right.image.dHash) <= 6) {
        related.union(identity(left), identity(right));
        nearDuplicatePairs += 1;
      }
    }
  const groups = [...new Set(entries.map((entry) => related.find(identity(entry))))].sort((a, b) =>
    sha256Hex(`${VISUAL_SEED}:${a}`).localeCompare(sha256Hex(`${VISUAL_SEED}:${b}`)),
  );
  const development = new Set(groups.slice(0, Math.ceil(groups.length / 3)));
  return {
    entries: entries.map((entry): VisualEntry => ({
      ...entry,
      group: sha256Hex(related.find(identity(entry))),
      partition: development.has(related.find(identity(entry))) ? 'development' : 'holdout',
    })),
    groupCount: groups.length,
    exactDuplicates,
    nearDuplicatePairs,
  };
}

export function imageManifest(
  campaignId: string,
  entries: VisualEntry[],
  failures: { sourceRecordKey: string; code: string }[],
  exclusions: Record<string, number>,
  grouping: { groupCount: number; exactDuplicates: number; nearDuplicatePairs: number },
) {
  const manifest = {
    version: VISUAL_CORPUS_VERSION,
    seed: VISUAL_SEED,
    campaignId,
    frame: 3,
    successfulImages: entries.length,
    failures,
    exclusions,
    ...grouping,
    items: entries.map((entry) => ({
      sourceRecordKey: entry.sourceRecordKey,
      imageKey: entry.image.title,
      imageSha256: entry.image.sha256,
      entrySha256: sha256Hex(canonicalJson(entry)),
      sourceVersion: entry.image.sourceVersion,
      group: entry.group,
      partition: entry.partition,
    })),
  };
  return { manifest, manifestSha256: sha256Hex(canonicalJson(manifest)) };
}
