import { expect, it } from 'vitest';

import { sha256Hex } from '../acquisition/source-record';
import { CORPUS_VERSION, type ReconciliationCorpus } from './contracts';
import { scoreReconciliation, type Review } from './evaluation';
import { reconcile } from './engine';
import { item, proposition, uuid } from './fixtures';

const input = item([proposition(), proposition(2, { value: false })]);
const corpus: ReconciliationCorpus = {
  version: CORPUS_VERSION,
  campaignId: uuid(900),
  asOf: '2026-10-22T00:00:00.000Z',
  frameDigest: sha256Hex('frame'),
  cases: [input],
  evidenceSnapshots: [],
};
const digest = sha256Hex('sealed');
const result = reconcile(input, corpus.asOf);
function review(
  reviewerId: string,
  relation: 'conflicting' | 'equivalent' = 'conflicting',
): Review {
  return {
    corpusDigest: digest,
    reviewerId,
    reviewerKind: 'independent_human',
    reviews: [
      {
        caseId: input.id,
        evidenceInspected: input.propositions.map((p) => p.evidenceId),
        rationale: 'Synthetic review fixture, not actual human judgment',
        pairs: [{ leftClaimId: uuid(1), rightClaimId: uuid(2), relation }],
        scopeError: false,
        temporalError: false,
        lineageError: false,
        unsupportedConclusion: false,
        correctAbstention: null,
      },
    ],
  };
}
it('reports null quality when labels are missing or only single-reviewed', () => {
  const missing = scoreReconciliation(corpus, digest, [result], []);
  expect(missing.status).toBe('independent_evaluation_incomplete');
  expect(missing.byRelation.conflicting?.precision.value).toBeNull();
  expect(scoreReconciliation(corpus, digest, [result], [review('one')]).scoredCases).toBe(0);
});
it('computes real held-out confusion counts, errors and uncertainty from double labels', () => {
  const scores = scoreReconciliation(corpus, digest, [result], [review('one'), review('two')]);
  expect(scores.scoredCases).toBe(1);
  expect(scores.byRelation.conflicting?.precision).toMatchObject({
    successes: 1,
    trials: 1,
    value: 1,
  });
  expect(scores.byRelation.conflicting?.precision.interval?.[0]).toBeLessThan(1);
  const errors = scoreReconciliation(
    corpus,
    digest,
    [result],
    [review('one', 'equivalent'), review('two', 'equivalent')],
  );
  expect(errors.byRelation.equivalent?.fn).toBe(1);
  expect(errors.byRelation.conflicting?.fp).toBe(1);
});
it('does not convert disagreement into consensus and requires a third adjudicator', () => {
  const reviews = [review('one'), review('two', 'equivalent')];
  expect(scoreReconciliation(corpus, digest, [result], reviews)).toMatchObject({
    disagreements: 1,
    scoredCases: 0,
  });
  const decision = review('third').reviews[0];
  if (decision === undefined) throw new Error('fixture');
  const adjudication = {
    corpusDigest: digest,
    adjudicatorId: 'third',
    decisions: [{ caseId: input.id, reviewerIds: ['one', 'two'], decision }],
  };
  expect(scoreReconciliation(corpus, digest, [result], reviews, adjudication)).toMatchObject({
    scoredCases: 1,
    adjudicated: 1,
  });
  expect(() =>
    scoreReconciliation(corpus, digest, [result], reviews, {
      ...adjudication,
      adjudicatorId: 'one',
    }),
  ).toThrow();
});
it('rejects wrong corpus, duplicate identities, missing Evidence and incomplete pair coverage', () => {
  expect(() =>
    scoreReconciliation(corpus, digest, [result], [{ ...review('one'), corpusDigest: 'other' }]),
  ).toThrow();
  expect(() =>
    scoreReconciliation(corpus, digest, [result], [review('same'), review('same')]),
  ).toThrow();
  const missing = review('one');
  for (const r of missing.reviews) r.evidenceInspected = [];
  expect(() => scoreReconciliation(corpus, digest, [result], [missing])).toThrow();
  const pairs = review('one');
  for (const r of pairs.reviews) r.pairs = [];
  expect(() => scoreReconciliation(corpus, digest, [result], [pairs])).toThrow();
});
