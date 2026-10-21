import { z } from 'zod';

import { foldText } from '../acquisition/text-normalization';
import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { documentSchema } from './documents';
import type { PrimaryDocument } from './documents';

export const CORPUS_VERSION = 'grp-text-corpus@1';
export const CORPUS_SEED = 'elpa-primary-text-2026-10';
export const corpusSchema = z
  .object({
    version: z.literal(CORPUS_VERSION),
    campaignId: z.uuid(),
    manifestSha256: z.string(),
    entries: z.array(
      z
        .object({
          partition: z.enum(['development', 'holdout']),
          group: z.string(),
          stratum: z.string(),
          countyCode: z.string().nullable(),
          document: documentSchema,
        })
        .strict(),
    ),
  })
  .strict();
export type Corpus = z.infer<typeof corpusSchema>;
export interface FrameEntry {
  document: PrimaryDocument;
  countyCode: string | null;
  urbanity: string;
}

function description(document: PrimaryDocument): string {
  return document.fields
    .filter((field) => field.section === 'description')
    .map((field) => field.text)
    .join('\n');
}

/** Leakage protection groups are deliberately conservative, never identity decisions. */
export function sampleCorpus(
  campaignId: string,
  frame: FrameEntry[],
  edges: { left: string; right: string; relation: string }[],
) {
  const identity = (entry: FrameEntry) =>
    `${entry.document.sourceKey}:${entry.document.sourceRecordKey}`;
  const byCandidate = new Map(frame.map((entry) => [entry.document.candidateId, identity(entry)]));
  const parents = new Map(frame.map((entry) => [identity(entry), identity(entry)]));
  const root = (key: string): string => {
    const parent = parents.get(key);
    if (parent === undefined || parent === key) return key;
    const result = root(parent);
    parents.set(key, result);
    return result;
  };
  const join = (left: string, right: string) => {
    const a = root(left);
    const b = root(right);
    parents.set(a < b ? b : a, a < b ? a : b);
  };
  for (const edge of edges) {
    const left = byCandidate.get(edge.left);
    const right = byCandidate.get(edge.right);
    if (edge.relation === 'same_property' && left !== undefined && right !== undefined)
      join(left, right);
  }
  const texts = frame
    .map((entry) => ({ key: identity(entry), text: foldText(description(entry.document)) }))
    .filter((entry) => entry.text.length >= 40);
  const exact = new Map<string, string>();
  for (const entry of texts) {
    const previous = exact.get(entry.text);
    if (previous !== undefined) join(previous, entry.key);
    else exact.set(entry.text, entry.key);
  }
  // At most the bounded descriptive subset, never pairwise national Candidate matching.
  if (texts.length > 2000) throw new Error('Descriptive frame exceeds bounded leakage-check limit');
  const tokens = texts.map((entry) => new Set(entry.text.split(' ')));
  let nearDuplicateEdges = 0;
  for (let i = 0; i < texts.length; i += 1)
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = tokens[i];
      const b = tokens[j];
      const left = texts[i];
      const right = texts[j];
      if (
        a === undefined ||
        b === undefined ||
        left === undefined ||
        right === undefined ||
        Math.min(a.size, b.size) < 8
      )
        continue;
      const intersection = [...a].filter((token) => b.has(token)).length;
      if (intersection / (a.size + b.size - intersection) >= 0.8) {
        join(left.key, right.key);
        nearDuplicateEdges += 1;
      }
    }
  const ranked = frame
    .map((entry) => {
      const text = description(entry.document);
      const content =
        text.length >= 200
          ? 'long_description'
          : text.length > 0
            ? 'short_description'
            : entry.document.fields.length > 0
              ? 'structured_only'
              : 'empty';
      const group = sha256Hex(root(identity(entry)));
      const partition =
        Number.parseInt(sha256Hex(`${CORPUS_SEED}:partition:${group}`).slice(0, 2), 16) < 77
          ? ('development' as const)
          : ('holdout' as const);
      return {
        ...entry,
        group,
        partition,
        stratum: `${entry.document.sourceKey}:${entry.urbanity}:${content}`,
        rank: sha256Hex(`${CORPUS_SEED}:rank:${identity(entry)}`),
      };
    })
    .sort((a, b) => a.rank.localeCompare(b.rank));
  const strata: Record<string, { population: number; selected: number }> = {};
  const groups = new Set<string>();
  const selected: Corpus['entries'] = [];
  for (const entry of ranked) {
    const key = `${entry.partition}:${entry.stratum}`;
    const counts = strata[key] ?? { population: 0, selected: 0 };
    counts.population += 1;
    if (!groups.has(entry.group) && counts.selected < 2) {
      selected.push({
        partition: entry.partition,
        group: entry.group,
        stratum: entry.stratum,
        countyCode: entry.countyCode,
        document: entry.document,
      });
      groups.add(entry.group);
      counts.selected += 1;
    }
    strata[key] = counts;
  }
  selected.sort((a, b) => a.document.id.localeCompare(b.document.id));
  const manifest = {
    version: CORPUS_VERSION,
    seed: CORPUS_SEED,
    campaignId,
    frameSize: frame.length,
    groupCount: new Set(ranked.map((entry) => entry.group)).size,
    nearDuplicateEdges,
    selected: selected.length,
    strata: Object.fromEntries(Object.entries(strata).sort(([a], [b]) => a.localeCompare(b))),
    artifacts: [
      ...new Map(
        frame.map((entry) => [
          entry.document.artifactSha256,
          { sha256: entry.document.artifactSha256, version: entry.document.sourceVersion },
        ]),
      ).values(),
    ],
    excludedFields: frame.reduce((sum, entry) => sum + entry.document.excludedFields.length, 0),
    items: selected.map((entry) => ({
      sourceKey: entry.document.sourceKey,
      sourceRecordKey: entry.document.sourceRecordKey,
      documentId: entry.document.id,
      textSha256: entry.document.textSha256,
      evidenceSha256: entry.document.evidenceSha256,
      group: entry.group,
      partition: entry.partition,
      stratum: entry.stratum,
      countyCode: entry.countyCode,
    })),
  };
  const corpus: Corpus = {
    version: CORPUS_VERSION,
    campaignId,
    manifestSha256: sha256Hex(canonicalJson(manifest)),
    entries: selected,
  };
  return { corpus, manifest };
}
