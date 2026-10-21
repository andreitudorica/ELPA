import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { aiProtocol, capturedRunSchema, importCapturedRun, PROMPT_VERSION } from './ai';
import { CORPUS_VERSION } from './corpus';
import type { Corpus } from './corpus';
import { extractDeterministically } from './deterministic';
import { ANNOTATION_VERSION, evaluateExtraction } from './evaluation';
import { syntheticDocument } from './fixtures.test-support';
import { ONTOLOGY_VERSION } from './ontology';
import { compareMethods } from './comparison';

const document = syntheticDocument('6 dormitoare. 3 băi.');
const corpus: Corpus = {
  version: CORPUS_VERSION,
  campaignId: document.candidateId,
  manifestSha256: 'synthetic',
  entries: [
    { partition: 'holdout', group: 'synthetic', stratum: 'synthetic', countyCode: null, document },
  ],
};
const output = extractDeterministically(document);
// Simulated annotation objects test the scorer, never an actual human benchmark.
const label = (id: string, facts = output.facts, role = 'reviewer') => ({
  version: ANNOTATION_VERSION,
  corpusManifestSha256: 'synthetic',
  reviewer: { id, human: true, independentOfDevelopment: true, role },
  documents: [
    {
      documentId: document.id,
      attributes: ['bedrooms_count', 'bathrooms_count'].map((attribute) => ({
        attribute,
        state: 'present',
        facts: facts.filter((fact) => fact.attribute === attribute),
        rationale: 'Synthetic test',
        conflicts: [],
      })),
      judgments: [],
    },
  ],
});

describe('independent holdout scoring', () => {
  it('reports null quality without independent labels or with a single reviewer', () => {
    expect(evaluateExtraction(corpus, [output], []).aggregate.precision.value).toBeNull();
    expect(evaluateExtraction(corpus, [output], [label('one')]).aggregate.recall.value).toBeNull();
    expect(
      evaluateExtraction(corpus, [output], [label('one'), label('one')]).invalidLabels,
    ).toContain('file_1:duplicate_reviewer');
  });

  it('counts true facts, incorrect values and missed facts independently', () => {
    const changed = {
      ...output,
      facts: output.facts
        .filter((fact) => fact.attribute === 'bedrooms_count')
        .map((fact) => ({ ...fact, value: 7 })),
    };
    const score = evaluateExtraction(corpus, [changed], [label('one'), label('two')]);
    expect(score.aggregate).toMatchObject({
      correctSupportedFacts: 0,
      incorrectClaims: 1,
      missedFacts: 2,
      f1: 0,
    });
    expect(
      score.perAttribute.find((row) => row.attribute === 'bedrooms_count')?.correctScopeRate.value,
    ).toBeNull();
    expect(
      evaluateExtraction(corpus, [output], [label('one'), label('two')]).aggregate.precision.value,
    ).toBe(1);
  });

  it('reports disagreements and requires a third adjudicator after two reviews', () => {
    const alternate = output.facts.map((fact) => ({ ...fact, value: 9 }));
    const disputed = evaluateExtraction(corpus, [output], [label('one'), label('two', alternate)]);
    expect(disputed.disputedCells).toBe(2);
    expect(disputed.aggregate.precision.value).toBeNull();
    const adjudicated = evaluateExtraction(
      corpus,
      [output],
      [label('one'), label('two', alternate), label('three', output.facts, 'adjudicator')],
    );
    expect(adjudicated.adjudicatedCells).toBe(2);
    expect(adjudicated.aggregate.precision.value).toBe(1);
  });

  it('rejects label grounding errors and identifies prediction grounding separately', () => {
    const invalid = output.facts.map((fact) => ({ ...fact, quote: 'fabricated' }));
    expect(evaluateExtraction(corpus, [output], [label('one', invalid)]).invalidLabels).toContain(
      'file_0:invalid_annotation',
    );
    const score = evaluateExtraction(
      corpus,
      [{ ...output, facts: invalid }],
      [label('one'), label('two')],
    );
    expect(score.grounding.failures).toBe(2);
    expect(score.aggregate.correctSupportedFacts).toBe(0);
  });
});

describe('bounded AI captured-output harness', () => {
  const capture = () => ({
    kind: 'captured_ai_run',
    corpusManifestSha256: 'synthetic',
    ontologyVersion: ONTOLOGY_VERSION,
    provider: 'synthetic',
    model: 'synthetic',
    modelVersion: 'synthetic-v1',
    promptVersion: PROMPT_VERSION,
    promptSha256: aiProtocol().promptSha256,
    parameters: { temperature: 0 },
    authorizationReference: 'synthetic-test-only',
    transferPermissionReference: 'synthetic-test-only',
    runType: 'captured_offline',
    executedAt: '2026-01-01T00:00:00Z',
    outputs: [
      {
        documentId: document.id,
        output,
        latencyMs: 1,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      },
    ],
  });

  it('validates metadata and quarantines malformed or invented evidence', () => {
    expect(capturedRunSchema.safeParse(capture()).success).toBe(true);
    expect(importCapturedRun(capture(), corpus).results[0]?.accepted).toEqual(output);
    const invalid = {
      ...capture(),
      outputs: [
        {
          ...capture().outputs[0],
          documentId: document.id,
          output: {
            ...output,
            facts: output.facts.map((fact) => ({ ...fact, quote: 'fabricated' })),
          },
          latencyMs: 1,
          inputTokens: null,
          outputTokens: null,
          cost: null,
        },
      ],
    };
    expect(importCapturedRun(invalid, corpus).results[0]?.accepted).toBeNull();
    expect(() =>
      importCapturedRun(
        { ...capture(), promptSha256: sha256Hex(canonicalJson({ wrong: true })) },
        corpus,
      ),
    ).toThrow('version mismatch');
  });

  it('calculates marginal facts and costs on the identical labeled holdout', () => {
    const captured = capture();
    const ai = importCapturedRun(
      {
        ...captured,
        outputs: captured.outputs.map((row) => ({
          ...row,
          cost: { amount: 0.02, currency: 'EUR' },
        })),
      },
      corpus,
    );
    const deterministic = [
      { ...output, facts: output.facts.filter((fact) => fact.attribute === 'bedrooms_count') },
    ];
    const compared = compareMethods(corpus, deterministic, [label('one'), label('two')], ai);
    expect(compared.additionalCorrectFacts).toBe(1);
    expect(compared.costPerAdditionalCorrectFact).toEqual({ amount: 0.02, currency: 'EUR' });
    expect(compared.aiStructuredOutputValidity.value).toBe(1);
    expect(compareMethods(corpus, deterministic, [], ai).additionalCorrectFacts).toBeNull();
    expect(compareMethods(corpus, deterministic, []).aiStatus).toBe('not_executed');
  });
});
