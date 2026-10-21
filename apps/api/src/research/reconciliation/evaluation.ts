import { z } from 'zod';

import { canonicalJson } from '../acquisition/source-record';
import { proportion } from '../evaluation/metrics';
import {
  ATTRIBUTES,
  RELATIONS,
  type ReconciliationCorpus,
  type ReconciliationResult,
} from './contracts';

export const reviewSchema = z
  .object({
    corpusDigest: z.string(),
    reviewerId: z.string().min(1),
    reviewerKind: z.literal('independent_human'),
    reviews: z.array(
      z
        .object({
          caseId: z.string(),
          evidenceInspected: z.array(z.uuid()).min(1),
          rationale: z.string().min(1),
          pairs: z.array(
            z
              .object({
                leftClaimId: z.uuid(),
                rightClaimId: z.uuid(),
                relation: z.enum(RELATIONS),
              })
              .strict(),
          ),
          scopeError: z.boolean(),
          temporalError: z.boolean(),
          lineageError: z.boolean(),
          unsupportedConclusion: z.boolean(),
          correctAbstention: z.boolean().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;
export const adjudicationSchema = z
  .object({
    corpusDigest: z.string(),
    adjudicatorId: z.string().min(1),
    decisions: z.array(
      z
        .object({
          caseId: z.string(),
          reviewerIds: z.array(z.string()).min(2),
          decision: reviewSchema.shape.reviews.element,
        })
        .strict(),
    ),
  })
  .strict();
export type Adjudication = z.infer<typeof adjudicationSchema>;

const pairKey = (a: string, b: string) => [a, b].sort().join(':');

/** Unlabeled and disputed cases are excluded explicitly; they never become correct negatives. */
export function scoreReconciliation(
  corpus: ReconciliationCorpus,
  digest: string,
  results: ReconciliationResult[],
  reviews: Review[],
  adjudication?: Adjudication,
) {
  if (new Set(reviews.map((r) => r.reviewerId)).size !== reviews.length)
    throw new Error('Reviewer identities must be distinct');
  const cases = new Map(corpus.cases.map((c) => [c.id, c]));
  const predictions = new Map(results.map((r) => [r.caseId, r]));
  for (const review of reviews) {
    reviewSchema.parse(review);
    if (review.corpusDigest !== digest) throw new Error('Review corpus mismatch');
    if (new Set(review.reviews.map((r) => r.caseId)).size !== review.reviews.length)
      throw new Error('Duplicate review case');
    for (const label of review.reviews) {
      const item = cases.get(label.caseId),
        prediction = predictions.get(label.caseId);
      if (item?.partition !== 'holdout' || prediction === undefined)
        throw new Error('Review must reference a held-out case');
      const expectedEvidence = [...new Set(item.propositions.map((p) => p.evidenceId))].sort();
      if (
        canonicalJson([...new Set(label.evidenceInspected)].sort()) !==
        canonicalJson(expectedEvidence)
      )
        throw new Error('Review must inspect every source Evidence');
      const expectedPairs = prediction.pairs
        .map((p) => pairKey(p.leftClaimId, p.rightClaimId))
        .sort();
      const actualPairs = label.pairs.map((p) => pairKey(p.leftClaimId, p.rightClaimId)).sort();
      if (canonicalJson(expectedPairs) !== canonicalJson(actualPairs))
        throw new Error('Review must label every comparable-attribute pair exactly once');
    }
  }
  if (adjudication !== undefined) {
    adjudicationSchema.parse(adjudication);
    if (
      adjudication.corpusDigest !== digest ||
      reviews.some((r) => r.reviewerId === adjudication.adjudicatorId)
    )
      throw new Error('Invalid adjudicator');
    if (
      adjudication.decisions.some(
        (d) => cases.get(d.caseId)?.partition !== 'holdout' || d.decision.caseId !== d.caseId,
      )
    )
      throw new Error('Unknown adjudication case');
    if (new Set(adjudication.decisions.map((r) => r.caseId)).size !== adjudication.decisions.length)
      throw new Error('Duplicate adjudication');
  }
  const labels: Review['reviews'] = [];
  let doubleReviewed = 0,
    disagreements = 0,
    adjudicated = 0;
  for (const item of corpus.cases.filter((c) => c.partition === 'holdout')) {
    const votes = reviews.flatMap((r) =>
      r.reviews
        .filter((v) => v.caseId === item.id)
        .map((v) => ({ reviewer: r.reviewerId, label: v })),
    );
    if (votes.length < 2) continue;
    doubleReviewed++;
    const signature = (label: Review['reviews'][number]) =>
      canonicalJson({
        ...label,
        rationale: '',
        pairs: label.pairs
          .map((p) => ({
            ...p,
            leftClaimId: [p.leftClaimId, p.rightClaimId].sort()[0],
            rightClaimId: [p.leftClaimId, p.rightClaimId].sort()[1],
          }))
          .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
        evidenceInspected: [...label.evidenceInspected].sort(),
      });
    if (new Set(votes.map((v) => signature(v.label))).size === 1) {
      const vote = votes[0];
      if (vote !== undefined) labels.push(vote.label);
    } else {
      disagreements++;
      const resolved = adjudication?.decisions.find((d) => d.caseId === item.id);
      if (resolved !== undefined) {
        if (
          resolved.decision.caseId !== item.id ||
          canonicalJson([...resolved.reviewerIds].sort()) !==
            canonicalJson(votes.map((v) => v.reviewer).sort())
        )
          throw new Error('Adjudication must reference all disagreeing reviewers');
        // Apply the same source-reference and pair-coverage validation to the adjudicated decision.
        scoreReconciliation(corpus, digest, results, [
          {
            corpusDigest: digest,
            reviewerId: adjudication?.adjudicatorId ?? '',
            reviewerKind: 'independent_human',
            reviews: [resolved.decision],
          },
        ]);
        labels.push(resolved.decision);
        adjudicated++;
      }
    }
  }
  const pairs = labels.flatMap((label) => {
    const result = predictions.get(label.caseId);
    return label.pairs.map((truth) => ({
      truth,
      prediction: result?.pairs.find(
        (p) =>
          pairKey(p.leftClaimId, p.rightClaimId) === pairKey(truth.leftClaimId, truth.rightClaimId),
      ),
    }));
  });
  const confusion = (positive: (typeof RELATIONS)[number], subset = pairs) => {
    const tp = subset.filter(
      (p) => p.truth.relation === positive && p.prediction?.relation === positive,
    ).length;
    const fp = subset.filter(
      (p) => p.truth.relation !== positive && p.prediction?.relation === positive,
    ).length;
    const fn = subset.filter(
      (p) => p.truth.relation === positive && p.prediction?.relation !== positive,
    ).length;
    const tn = subset.length - tp - fp - fn;
    return {
      tp,
      fp,
      fn,
      tn,
      precision: proportion(tp, tp + fp),
      recall: proportion(tp, tp + fn),
      falsePositiveRate: proportion(fp, fp + tn),
      missedRate: proportion(fn, tp + fn),
    };
  };
  return {
    status:
      labels.length === 0
        ? 'independent_evaluation_incomplete'
        : 'partially_independently_evaluated',
    corpusDigest: digest,
    holdoutCases: corpus.cases.filter((c) => c.partition === 'holdout').length,
    reviewers: reviews.length,
    doubleReviewed,
    disagreements,
    adjudicated,
    scoredCases: labels.length,
    scoredPairs: pairs.length,
    byRelation: Object.fromEntries(RELATIONS.map((r) => [r, confusion(r)])),
    byAttribute: Object.fromEntries(
      ATTRIBUTES.map((attribute) => {
        const subset = pairs.filter((p) => p.prediction?.attribute === attribute);
        return [
          attribute,
          {
            n: subset.length,
            byRelation: Object.fromEntries(RELATIONS.map((r) => [r, confusion(r, subset)])),
            correct: proportion(
              subset.filter((p) => p.truth.relation === p.prediction?.relation).length,
              subset.length,
            ),
          },
        ];
      }),
    ),
    entityScopeErrors: proportion(labels.filter((l) => l.scopeError).length, labels.length),
    temporalErrors: proportion(labels.filter((l) => l.temporalError).length, labels.length),
    correlatedEvidenceErrors: proportion(
      labels.filter((l) => l.lineageError).length,
      labels.length,
    ),
    unsupportedConclusions: proportion(
      labels.filter((l) => l.unsupportedConclusion).length,
      labels.length,
    ),
    correctAbstention: proportion(
      labels.filter((l) => l.correctAbstention === true).length,
      labels.filter((l) => l.correctAbstention !== null).length,
    ),
    uncertainty:
      'Wilson intervals are descriptive; pairs share properties and are not independent national samples.',
  };
}
