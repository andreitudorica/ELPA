import { z } from 'zod';

import { cohensKappa, proportion } from '../evaluation/metrics';

const labelSchema = z.object({
  source_record_key: z.string().min(1),
  reviewer_id: z.string().min(1),
  reviewer_type: z.enum(['independent_human', 'developer', 'ai']),
  reviewed_at: z.iso.datetime(),
  discovery_decision: z.enum(['existing', 'new_in_scope', 'out_of_scope', 'cannot_determine']),
  evidence_urls: z.string().min(1),
  evidence_locator: z.string().min(1),
});

/** Only independently labelled holdout records can produce headline metrics. */
export function scoreIncrementalReview(
  predictions: { sourceRecordKey: string; partition: string; classification: string }[],
  labels: unknown[],
) {
  const holdout = predictions.filter((row) => row.partition === 'evaluation');
  const byKey = new Map(holdout.map((row) => [row.sourceRecordKey, row]));
  const seen = new Set<string>();
  const independent = new Map<string, z.infer<typeof labelSchema>[]>();
  let nonIndependentLabels = 0;
  for (const input of labels) {
    const row = labelSchema.parse(input);
    if (!byKey.has(row.source_record_key)) throw new Error('Label is not in the frozen holdout');
    const unique = `${row.source_record_key}|${row.reviewer_id}`;
    if (seen.has(unique)) throw new Error('Duplicate label from the same reviewer');
    seen.add(unique);
    if (row.reviewer_type !== 'independent_human') {
      nonIndependentLabels += 1;
      continue;
    }
    const group = independent.get(row.source_record_key) ?? [];
    group.push(row);
    independent.set(row.source_record_key, group);
  }
  const accepted: { classification: string; decision: string }[] = [];
  const agreement: [string, string][] = [];
  let disputed = 0;
  let singleReviewer = 0;
  let unresolved = 0;
  for (const [key, group] of independent) {
    const first = group[0];
    const second = group[1];
    if (first === undefined || second === undefined) {
      singleReviewer += 1;
      continue;
    }
    agreement.push([first.discovery_decision, second.discovery_decision]);
    if (new Set(group.map((row) => row.discovery_decision)).size > 1) {
      disputed += 1;
      continue;
    }
    if (first.discovery_decision === 'cannot_determine') {
      unresolved += 1;
      continue;
    }
    const prediction = byKey.get(key);
    if (prediction !== undefined)
      accepted.push({
        classification: prediction.classification,
        decision: first.discovery_decision,
      });
  }
  const discoveries = accepted.filter(
    (row) => row.classification === 'apparent_discovery_unreviewed',
  );
  const likely = accepted.filter((row) => row.classification === 'likely_existing_unreviewed');
  const discoveryPrecision = proportion(
    discoveries.filter((row) => row.decision === 'new_in_scope').length,
    discoveries.length,
  );
  return {
    holdoutRecords: holdout.length,
    labels: labels.length,
    nonIndependentLabels,
    resolvedDoubleReviewed: accepted.length,
    disputed,
    singleReviewer,
    unresolved,
    confirmedNewInReviewedSample: accepted.filter((row) => row.decision === 'new_in_scope').length,
    discoveryPrecision,
    likelyRecordExistingPrecision: proportion(
      likely.filter((row) => row.decision === 'existing').length,
      likely.length,
    ),
    agreementKappa: cohensKappa(agreement),
    h1GatePassed:
      discoveryPrecision.successes >= 5 && (discoveryPrecision.interval?.[0] ?? 0) > 0.5,
    caveat:
      'Unweighted reviewed-sample metrics. Existing-property classification does not establish correctness of a particular suggested pair; pair false-merge rate requires pair-specific review. No national yield extrapolation.',
  };
}
