import { foldText } from '../acquisition/text-normalization';
import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { UnionFind } from '../grouping/union-find';
import { SEED } from './contracts';
export interface FrameEntry {
  candidateId: string;
  sourceKey: string;
  sourceRecordKey: string;
  countyCode: string | null;
  claimId: string;
  evidenceId: string;
  target: string;
  method: string;
  evidenceSha256: string;
  description: string | null;
}
type Frame = FrameEntry[];
interface Edge {
  left: string;
  right: string;
  relation: string;
}

/** Conservative leakage blocking is not a property-identity decision. */
export function sampleGroups(
  frame: Frame,
  members: { id: string; sourceKey: string; sourceRecordKey: string }[],
  edges: Edge[],
) {
  const groups = new UnionFind();
  const identities = new Map(members.map((m) => [m.id, `${m.sourceKey}:${m.sourceRecordKey}`]));
  const identity = (id: string) => identities.get(id) ?? id;
  for (const edge of edges)
    if (edge.relation === 'same_property') groups.union(identity(edge.left), identity(edge.right));
  const hashes = new Map<string, string>();
  const descriptions = new Map<string, { id: string; tokens: Set<string> }>();
  for (const row of frame) {
    const id = identity(row.candidateId);
    for (const key of [
      row.evidenceSha256,
      ...(row.description === null || row.description.length < 80
        ? []
        : [sha256Hex(foldText(row.description))]),
    ]) {
      const other = hashes.get(key);
      if (other !== undefined) groups.union(id, other);
      else hashes.set(key, id);
    }
    if (row.description !== null && row.description.length >= 80)
      descriptions.set(id, { id, tokens: new Set(foldText(row.description).split(/\s+/)) });
  }
  // Bounded original descriptive subset only; never compare national Candidate pairs.
  if (descriptions.size > 2000)
    throw new Error('Descriptive leakage frame exceeds the experiment bound');
  const texts = [...descriptions.values()];
  let nearTextEdges = 0;
  for (let i = 0; i < texts.length; i++) {
    const left = texts[i];
    if (left === undefined) continue;
    for (const right of texts.slice(i + 1)) {
      const intersection = [...left.tokens].filter((token) => right.tokens.has(token)).length;
      if (intersection / (left.tokens.size + right.tokens.size - intersection) >= 0.8) {
        groups.union(left.id, right.id);
        nearTextEdges++;
      }
    }
  }
  const grouped = new Map<string, Frame>();
  for (const row of frame) {
    const group = sha256Hex(groups.find(identity(row.candidateId)));
    grouped.set(group, [...(grouped.get(group) ?? []), row]);
  }
  const ranked = [...grouped.entries()]
    .map(([group, rows]) => {
      const candidateIds = [...new Set(rows.map((r) => r.candidateId))].sort();
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.candidateId}:${row.target}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const stratum = [...counts.values()].some((n) => n > 1)
        ? ('reprocessed' as const)
        : candidateIds.length > 1
          ? ('cross_candidate' as const)
          : ('single_source' as const);
      const sourceFamilies = [...new Set(rows.map((r) => r.sourceKey))].sort().join('+');
      const attributes = [...new Set(rows.map((r) => r.target))].sort().join('+');
      const bucket = `${stratum}:${sourceFamilies}:${attributes}`;
      return { group, rows, candidateIds, stratum, bucket, rank: sha256Hex(`${SEED}:${group}`) };
    })
    .sort((a, b) => a.rank.localeCompare(b.rank));
  const strata: Record<string, number> = {},
    selected: ((typeof ranked)[number] & { partition: 'development' | 'holdout' })[] = [];
  const exclusions: { group: string; reason: string }[] = [];
  for (const entry of ranked) {
    if (entry.candidateIds.length > 100 || entry.rows.length > 200) {
      exclusions.push({ group: entry.group, reason: 'case_bound' });
      continue;
    }
    const count = strata[entry.bucket] ?? 0;
    strata[entry.bucket] = count + 1;
    if (count < 4)
      selected.push({ ...entry, partition: count % 2 === 0 ? 'development' : 'holdout' });
  }
  if (selected.length > 48)
    throw new Error('Stratified sample exceeds 48 cases; revise and version the sampling plan');
  return {
    selected,
    summary: {
      frameClaims: frame.length,
      frameCandidates: new Set(frame.map((r) => r.candidateId)).size,
      leakageGroups: grouped.size,
      descriptiveRecords: descriptions.size,
      nearTextEdges,
      strata,
      exclusions,
      selectedGroups: selected.length,
      seed: SEED,
    },
    frameDigest: sha256Hex(
      canonicalJson({
        frame: frame.map(({ description, ...row }) => ({
          ...row,
          descriptionHash: description === null ? null : sha256Hex(description),
        })),
        members: [...members].sort((a, b) => a.id.localeCompare(b.id)),
        edges: [...edges].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
      }),
    ),
  };
}
