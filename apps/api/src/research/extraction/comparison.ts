import { proportion } from '../evaluation/metrics';
import type { importCapturedRun } from './ai';
import type { ExtractionOutput } from './contracts';
import type { Corpus } from './corpus';
import { evaluateExtraction } from './evaluation';

/** Same holdout corpus/rubric; no model or hybrid is assumed to outperform rules. */
export function compareMethods(
  corpus: Corpus,
  deterministic: ExtractionOutput[],
  labels: unknown[],
  ai?: ReturnType<typeof importCapturedRun>,
) {
  const a = evaluateExtraction(corpus, deterministic, labels);
  const b =
    ai === undefined
      ? null
      : evaluateExtraction(
          corpus,
          ai.results.flatMap((result) => (result.accepted === null ? [] : [result.accepted])),
          labels,
        );
  const aCorrect = new Set(a.correctFactIds);
  const additional =
    b === null || a.scoredHoldoutCells === 0 || b.scoredHoldoutCells === 0
      ? null
      : b.correctFactIds.filter((id) => !aCorrect.has(id)).length;
  const costs = ai?.results.map((result) => result.cost) ?? [];
  const observedCosts = costs.flatMap((cost) => (cost === null ? [] : [cost]));
  const currency = observedCosts[0]?.currency;
  const cost =
    costs.length > 0 &&
    observedCosts.length === costs.length &&
    currency !== undefined &&
    observedCosts.every((entry) => entry.currency === currency)
      ? { amount: observedCosts.reduce((sum, entry) => sum + entry.amount, 0), currency }
      : null;
  return {
    version: 'grp-method-comparison@1',
    corpusManifestSha256: corpus.manifestSha256,
    deterministic: a,
    ai: b,
    aiStatus: ai === undefined ? 'not_executed' : ai.metadata.runType,
    aiStructuredOutputValidity:
      ai === undefined
        ? proportion(0, 0)
        : proportion(
            ai.results.filter((result) => result.accepted !== null).length,
            ai.results.length,
          ),
    aiLatencyMs:
      ai === undefined ? null : ai.results.reduce((sum, result) => sum + result.latencyMs, 0),
    observedAiCost: cost,
    additionalCorrectFacts: additional,
    costPerAdditionalCorrectFact:
      cost === null || additional === null || additional <= 0
        ? null
        : { amount: cost.amount / additional, currency: cost.currency },
    hybrid: {
      status: 'not_executed',
      reason: 'No independently evaluated AI advantage justifies selecting hybrid rules.',
    },
    decision: 'investigate_further',
  };
}
