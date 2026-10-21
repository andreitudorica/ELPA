import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { cohensKappa, proportion } from '../evaluation/metrics';
import { factIdentity, factSchema, validateFact } from './contracts';
import type { ExtractedFact, ExtractionOutput } from './contracts';
import type { Corpus } from './corpus';
import { ATTRIBUTE_IDS, attributeIdSchema } from './ontology';

export const ANNOTATION_VERSION = 'grp-annotation@1';
const cellSchema = z
  .object({
    attribute: attributeIdSchema,
    state: z.enum(['present', 'explicit_negative', 'unknown', 'not_applicable', 'ambiguous']),
    facts: z.array(factSchema),
    rationale: z.string(),
    conflicts: z.array(z.string()),
  })
  .strict();
const judgmentSchema = z
  .object({
    factId: z.string(),
    support: z.enum(['supported', 'unsupported', 'ambiguous']),
    valueCorrect: z.boolean(),
    normalizationCorrect: z.boolean(),
    scopeCorrect: z.boolean(),
    negationCorrect: z.boolean(),
    temporalCorrect: z.boolean(),
    notes: z.string(),
  })
  .strict();
export const annotationSchema = z
  .object({
    version: z.literal(ANNOTATION_VERSION),
    corpusManifestSha256: z.string(),
    reviewer: z
      .object({
        id: z.string().min(1),
        human: z.literal(true),
        independentOfDevelopment: z.literal(true),
        role: z.enum(['reviewer', 'adjudicator']),
      })
      .strict(),
    documents: z.array(
      z
        .object({
          documentId: z.string(),
          attributes: z.array(cellSchema),
          judgments: z.array(judgmentSchema),
        })
        .strict(),
    ),
  })
  .strict();
type Annotation = z.infer<typeof annotationSchema>;
type Cell = z.infer<typeof cellSchema>;

export function annotationTemplate(corpus: Corpus) {
  return {
    version: ANNOTATION_VERSION,
    corpusManifestSha256: corpus.manifestSha256,
    reviewer: { id: '', human: false, independentOfDevelopment: false, role: 'reviewer' },
    documents: corpus.entries.map((entry) => ({
      documentId: entry.document.id,
      attributes: ATTRIBUTE_IDS.map((attribute) => ({
        attribute,
        state: 'unreviewed',
        facts: [],
        rationale: '',
        conflicts: [],
      })),
      judgments: [],
    })),
  };
}

function canonicalCell(cell: Cell): string {
  return canonicalJson({
    state: cell.state,
    facts: cell.facts.map(factIdentity).sort(),
    conflicts: [...cell.conflicts].sort(),
  });
}

export function predictionId(fact: ExtractedFact): string {
  return sha256Hex(factIdentity(fact));
}

function judgmentIdentity(judgment: z.infer<typeof judgmentSchema>): string {
  return canonicalJson({ ...judgment, notes: undefined });
}

/** Strict held-out fact matching, with separate human semantic/error judgments. */
export function evaluateExtraction(corpus: Corpus, outputs: ExtractionOutput[], inputs: unknown[]) {
  const documents = new Map(corpus.entries.map((entry) => [entry.document.id, entry.document]));
  const holdout = new Set(
    corpus.entries
      .filter((entry) => entry.partition === 'holdout')
      .map((entry) => entry.document.id),
  );
  const labels: Annotation[] = [];
  const invalidLabels: string[] = [];
  const reviewerIds = new Set<string>();
  for (const [index, input] of inputs.entries()) {
    const parsed = annotationSchema.safeParse(input);
    if (!parsed.success || parsed.data.corpusManifestSha256 !== corpus.manifestSha256) {
      invalidLabels.push(`file_${String(index)}:schema_or_corpus`);
      continue;
    }
    const label = parsed.data;
    if (reviewerIds.has(label.reviewer.id)) {
      invalidLabels.push(`file_${String(index)}:duplicate_reviewer`);
      continue;
    }
    const docIds = label.documents.map((document) => document.documentId);
    if (new Set(docIds).size !== docIds.length) {
      invalidLabels.push(`file_${String(index)}:duplicate_document`);
      continue;
    }
    let valid = true;
    for (const annotated of label.documents) {
      const document = documents.get(annotated.documentId);
      const attributes = annotated.attributes.map((cell) => cell.attribute);
      if (
        document === undefined ||
        new Set(attributes).size !== attributes.length ||
        new Set(annotated.judgments.map((judgment) => judgment.factId)).size !==
          annotated.judgments.length
      ) {
        valid = false;
        break;
      }
      for (const cell of annotated.attributes) {
        if (
          cell.facts.some(
            (fact) => fact.attribute !== cell.attribute || validateFact(fact, document).length > 0,
          )
        )
          valid = false;
        if (['unknown', 'not_applicable'].includes(cell.state) && cell.facts.length > 0)
          valid = false;
        if (cell.state === 'present' && cell.facts.length === 0) valid = false;
      }
    }
    if (!valid) {
      invalidLabels.push(`file_${String(index)}:invalid_annotation`);
      continue;
    }
    reviewerIds.add(label.reviewer.id);
    labels.push(label);
  }
  const byCell = new Map<string, { label: Annotation; cell: Cell }[]>();
  const judgments = new Map<
    string,
    { label: Annotation; judgment: z.infer<typeof judgmentSchema> }[]
  >();
  for (const label of labels)
    for (const document of label.documents) {
      for (const cell of document.attributes) {
        const key = `${document.documentId}:${cell.attribute}`;
        byCell.set(key, [...(byCell.get(key) ?? []), { label, cell }]);
      }
      for (const judgment of document.judgments)
        judgments.set(`${document.documentId}:${judgment.factId}`, [
          ...(judgments.get(`${document.documentId}:${judgment.factId}`) ?? []),
          { label, judgment },
        ]);
    }
  const resolved = new Map<string, Cell>();
  const agreement: [string, string][] = [];
  let disputed = 0;
  let single = 0;
  let ambiguous = 0;
  let adjudicated = 0;
  for (const [key, rows] of byCell) {
    const reviews = rows.filter((row) => row.label.reviewer.role === 'reviewer');
    const adjudicators = rows.filter((row) => row.label.reviewer.role === 'adjudicator');
    if (reviews.length < 2) {
      single += 1;
      continue;
    }
    const a = reviews[0];
    const b = reviews[1];
    if (a === undefined || b === undefined) continue;
    agreement.push([canonicalCell(a.cell), canonicalCell(b.cell)]);
    const allAgree = reviews.every((row) => canonicalCell(row.cell) === canonicalCell(a.cell));
    const adjudicator = adjudicators.length === 1 ? adjudicators[0] : undefined;
    const cell = allAgree ? a.cell : adjudicator?.cell;
    if (cell === undefined) {
      disputed += 1;
      continue;
    }
    if (!allAgree) adjudicated += 1;
    if (cell.state === 'ambiguous') {
      ambiguous += 1;
      continue;
    }
    resolved.set(key, cell);
  }
  const outputCounts = new Map<string, number>();
  for (const output of outputs)
    outputCounts.set(output.documentId, (outputCounts.get(output.documentId) ?? 0) + 1);
  if ([...outputCounts.values()].some((count) => count > 1))
    throw new Error('Duplicate prediction document');
  const predictions = outputs.flatMap((output) => output.facts);
  const correctFactIds = new Set<string>();
  const groundingErrors = predictions.flatMap((fact) => {
    const document = documents.get(fact.documentId);
    return (document === undefined ? ['document_identity'] : validateFact(fact, document)).map(
      (code) => ({ factId: predictionId(fact), code }),
    );
  });
  const perAttribute = ATTRIBUTE_IDS.map((attribute) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let cells = 0;
    let abstained = 0;
    const diagnostics = {
      support: [] as boolean[],
      value: [] as boolean[],
      normalization: [] as boolean[],
      scope: [] as boolean[],
      negation: [] as boolean[],
      temporal: [] as boolean[],
    };
    for (const documentId of holdout) {
      const cell = resolved.get(`${documentId}:${attribute}`);
      if (cell === undefined) continue;
      cells += 1;
      const predicted = predictions.filter(
        (fact) => fact.documentId === documentId && fact.attribute === attribute,
      );
      if (predicted.length === 0) abstained += 1;
      const remaining = new Set(cell.facts.map((_, index) => index));
      for (const fact of predicted) {
        const document = documents.get(documentId);
        const match = cell.facts.findIndex(
          (gold, index) =>
            remaining.has(index) &&
            factIdentity(gold) === factIdentity(fact) &&
            canonicalJson(gold.fieldPath) === canonicalJson(fact.fieldPath) &&
            gold.start < fact.end &&
            fact.start < gold.end,
        );
        if (document !== undefined && validateFact(fact, document).length === 0 && match >= 0) {
          tp += 1;
          remaining.delete(match);
          correctFactIds.add(predictionId(fact));
        } else fp += 1;
        const rows = judgments.get(`${documentId}:${predictionId(fact)}`) ?? [];
        const reviews = rows.filter((row) => row.label.reviewer.role === 'reviewer');
        if (reviews.length >= 2) {
          const first = reviews[0];
          const adjudicators = rows.filter((row) => row.label.reviewer.role === 'adjudicator');
          const judgment =
            first !== undefined &&
            reviews.every(
              (row) => judgmentIdentity(row.judgment) === judgmentIdentity(first.judgment),
            )
              ? first.judgment
              : adjudicators.length === 1
                ? adjudicators[0]?.judgment
                : undefined;
          if (judgment !== undefined && judgment.support !== 'ambiguous') {
            diagnostics.support.push(judgment.support === 'supported');
            diagnostics.value.push(judgment.valueCorrect);
            diagnostics.normalization.push(judgment.normalizationCorrect);
            diagnostics.scope.push(judgment.scopeCorrect);
            if (fact.explicitness === 'explicit_negative')
              diagnostics.negation.push(judgment.negationCorrect);
            if (fact.temporal.kind !== 'unspecified')
              diagnostics.temporal.push(judgment.temporalCorrect);
          }
        }
      }
      fn += remaining.size;
    }
    const precision = proportion(tp, tp + fp);
    const recall = proportion(tp, tp + fn);
    const diagnostic = (values: boolean[]) =>
      proportion(values.filter(Boolean).length, values.length);
    return {
      attribute,
      labeledDocumentAttributes: cells,
      correctSupportedFacts: tp,
      incorrectClaims: fp,
      missedFacts: fn,
      precision,
      recall,
      f1:
        precision.value === null || recall.value === null
          ? null
          : tp === 0
            ? 0
            : (2 * tp) / (2 * tp + fp + fn),
      unsupportedClaimRate: proportion(
        diagnostics.support.filter((supported) => !supported).length,
        diagnostics.support.length,
      ),
      missedFactRate: proportion(fn, tp + fn),
      correctValueRate: diagnostic(diagnostics.value),
      correctNormalizationRate: diagnostic(diagnostics.normalization),
      correctScopeRate: diagnostic(diagnostics.scope),
      negationAccuracy: diagnostic(diagnostics.negation),
      temporalAccuracy: diagnostic(diagnostics.temporal),
      abstentionRate: proportion(abstained, cells),
    };
  });
  const tp = perAttribute.reduce((sum, row) => sum + row.correctSupportedFacts, 0);
  const fp = perAttribute.reduce((sum, row) => sum + row.incorrectClaims, 0);
  const fn = perAttribute.reduce((sum, row) => sum + row.missedFacts, 0);
  const scoredHoldoutCells = perAttribute.reduce(
    (sum, row) => sum + row.labeledDocumentAttributes,
    0,
  );
  const pooled = (
    key:
      | 'unsupportedClaimRate'
      | 'correctNormalizationRate'
      | 'correctScopeRate'
      | 'correctValueRate'
      | 'negationAccuracy'
      | 'temporalAccuracy'
      | 'abstentionRate',
  ) =>
    proportion(
      perAttribute.reduce((sum, row) => sum + row[key].successes, 0),
      perAttribute.reduce((sum, row) => sum + row[key].trials, 0),
    );
  return {
    version: 'grp-extraction-score@1',
    status:
      scoredHoldoutCells === 0
        ? 'independent_ground_truth_incomplete'
        : 'partially_or_fully_labeled',
    independentReviewers: labels.filter((label) => label.reviewer.role === 'reviewer').length,
    invalidLabels,
    singleAnnotatedCells: single,
    disputedCells: disputed,
    ambiguousCells: ambiguous,
    adjudicatedCells: adjudicated,
    agreement: {
      pairedCells: agreement.length,
      kappa: cohensKappa(agreement),
      disagreements: agreement.filter(([a, b]) => a !== b).length,
    },
    holdoutDocuments: holdout.size,
    holdoutPredictionsMissing: [...holdout].filter((id) => !outputCounts.has(id)).length,
    scoredHoldoutCells,
    correctFactIds: [...correctFactIds].sort(),
    grounding: {
      facts: predictions.length,
      failures: new Set(groundingErrors.map((error) => error.factId)).size,
      errors: groundingErrors,
      semanticCorrectness: 'requires independent human annotation',
    },
    aggregate: {
      correctSupportedFacts: tp,
      incorrectClaims: fp,
      missedFacts: fn,
      precision: proportion(tp, tp + fp),
      recall: proportion(tp, tp + fn),
      f1: tp + fp + fn === 0 ? null : (2 * tp) / (2 * tp + fp + fn),
      unsupportedClaimRate: pooled('unsupportedClaimRate'),
      missedFactRate: proportion(fn, tp + fn),
      correctNormalizationRate: pooled('correctNormalizationRate'),
      correctScopeRate: pooled('correctScopeRate'),
      correctValueRate: pooled('correctValueRate'),
      negationAccuracy: pooled('negationAccuracy'),
      temporalAccuracy: pooled('temporalAccuracy'),
      abstentionRate: pooled('abstentionRate'),
    },
    perAttribute,
  };
}
