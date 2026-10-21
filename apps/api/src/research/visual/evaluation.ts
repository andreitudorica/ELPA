import { z } from 'zod';

import { canonicalJson } from '../acquisition/source-record';
import { cohensKappa, proportion } from '../evaluation/metrics';
import { regionSchema } from './contracts';
import type { VisualCorpus } from './corpus';
import {
  FEATURE_DEFINITIONS,
  featureSchema,
  VISUAL_FEATURES,
  VISUAL_SPEC_VERSION,
} from './specification';
import type { ImportedVisionRun } from './vision';

const annotationCellSchema = z
  .object({
    feature: featureSchema,
    visibility: z.enum(['clear', 'partial', 'not_visible', 'uncertain']),
    region: regionSchema.nullable(),
    propertyAttribution: z.enum([
      'belongs_to_candidate',
      'nearby',
      'shared',
      'unrelated',
      'unknown',
    ]),
    attributionEvidence: z.string().nullable(),
    ambiguity: z.string(),
    availability: z.literal('not_established_by_photo'),
  })
  .strict();
export const annotationSchema = z
  .object({
    version: z.literal('grp-visual-annotation@1'),
    specificationVersion: z.literal(VISUAL_SPEC_VERSION),
    corpusManifestSha256: z.string(),
    reviewer: z.string().min(1),
    role: z.literal('independent_human'),
    independentlyCompleted: z.literal(true),
    reviewedAt: z.iso.datetime(),
    images: z
      .array(
        z
          .object({
            evidenceId: z.uuid(),
            imageSha256: z.string(),
            expectedProperty: z.enum(['yes', 'no', 'unknown']),
            scene: z.enum(['photograph', 'possible_rendering', 'stock_or_promotional', 'unknown']),
            conditions: z.array(
              z.enum([
                'nearby_attraction',
                'stock',
                'rendering',
                'neighbor',
                'shared',
                'old',
                'wide_angle',
                'occluded',
                'night',
                'low_quality',
              ]),
            ),
            cells: z.array(annotationCellSchema).length(VISUAL_FEATURES.length),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
type Cell = z.infer<typeof annotationCellSchema>;

export function annotationTemplate(corpus: VisualCorpus) {
  return {
    version: 'grp-visual-annotation@1',
    specificationVersion: VISUAL_SPEC_VERSION,
    corpusManifestSha256: corpus.manifestSha256,
    reviewer: null,
    role: 'independent_human',
    independentlyCompleted: null,
    reviewedAt: null,
    images: corpus.entries.map((entry) => ({
      evidenceId: entry.evidenceId,
      imageSha256: entry.image.sha256,
      expectedProperty: null,
      scene: null,
      conditions: [],
      cells: VISUAL_FEATURES.map((feature) => ({
        feature,
        visibility: null,
        region: null,
        propertyAttribution: null,
        attributionEvidence: null,
        ambiguity: '',
        availability: 'not_established_by_photo',
      })),
    })),
  };
}

export function comparisonCategory(
  feature: keyof typeof FEATURE_DEFINITIONS,
  visibility: string,
  attribution: string,
  text: { target: string; value: unknown }[],
) {
  if (attribution === 'nearby' || attribution === 'unrelated') return 'irrelevant_to_property';
  if (visibility !== 'clear') return 'uncertain_visual_observation';
  if (attribution !== 'belongs_to_candidate') return 'cannot_attribute_to_property';
  const definition = FEATURE_DEFINITIONS[feature];
  const related = text.filter((claim) => claim.target === definition.textTarget);
  if (related.some((claim) => canonicalJson(claim.value) === canonicalJson(definition.textValue)))
    return 'consistent_with_proposed_text';
  if (related.some((claim) => claim.value === false)) return 'potential_conflict_requires_review';
  return 'new_visual_observation_review_pending';
}

export function evaluateVisual(
  corpus: VisualCorpus,
  rawLabels: unknown[],
  model: ImportedVisionRun | null,
  textClaims: { candidateId: string; target: string; value: unknown }[],
) {
  const sheets = rawLabels.map((input) => annotationSchema.parse(input));
  if (new Set(sheets.map((sheet) => sheet.reviewer)).size !== sheets.length)
    throw new Error('Duplicate independent reviewer');
  const entries = new Map(corpus.entries.map((entry) => [entry.evidenceId, entry]));
  const reviews = new Map<string, Cell[]>();
  const imageReviews = new Map<
    string,
    { expectedProperty: string; scene: string; conditions: string[] }[]
  >();
  for (const sheet of sheets) {
    if (sheet.corpusManifestSha256 !== corpus.manifestSha256)
      throw new Error('Annotation corpus mismatch');
    const seen = new Set<string>();
    for (const image of sheet.images) {
      const entry = entries.get(image.evidenceId);
      if (
        entry?.image.sha256 !== image.imageSha256 ||
        seen.has(image.evidenceId) ||
        new Set(image.cells.map((cell) => cell.feature)).size !== VISUAL_FEATURES.length
      )
        throw new Error('Invalid annotation image or duplicate feature');
      seen.add(image.evidenceId);
      imageReviews.set(image.evidenceId, [...(imageReviews.get(image.evidenceId) ?? []), image]);
      for (const cell of image.cells) {
        if (
          cell.propertyAttribution === 'belongs_to_candidate' &&
          !cell.attributionEvidence?.trim()
        )
          throw new Error('Property attribution requires independently reviewed source context');
        const key = `${image.evidenceId}:${cell.feature}`;
        reviews.set(key, [...(reviews.get(key) ?? []), cell]);
      }
    }
  }
  const predictions = new Map(
    (model?.results ?? []).flatMap((result) =>
      result.accepted === null
        ? []
        : result.accepted.observations.map(
            (observation) => [`${result.evidenceId}:${observation.feature}`, observation] as const,
          ),
    ),
  );
  const paired: [string, string][] = [];
  let disagreements = 0;
  let totalCells = 0;
  let wrongAttributions = 0;
  let attributablePredictions = 0;
  let correctAttributions = 0;
  let shared = 0;
  const comparisons: Record<string, number> = {};
  const validatedGain = new Set<string>();
  const evaluatedProperties = new Set<string>();
  const perFeature = VISUAL_FEATURES.map((feature) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let abstentions = 0;
    let reviewed = 0;
    let difficult = 0;
    let difficultErrors = 0;
    let difficultPositivePredictions = 0;
    let unresolvedPositives = 0;
    for (const entry of corpus.entries.filter((entry) => entry.partition === 'holdout')) {
      const cells = reviews.get(`${entry.evidenceId}:${feature}`) ?? [];
      if (cells.length >= 2) {
        const first = cells[0];
        const second = cells[1];
        if (first !== undefined && second !== undefined)
          paired.push([
            `${first.visibility}:${first.propertyAttribution}`,
            `${second.visibility}:${second.propertyAttribution}`,
          ]);
      }
      if (cells.length < 2) continue;
      const gold = cells[0];
      if (gold === undefined) continue;
      if (
        cells.some(
          (cell) =>
            cell.visibility !== gold.visibility ||
            cell.propertyAttribution !== gold.propertyAttribution,
        )
      ) {
        disagreements += 1;
        continue;
      }
      reviewed += 1;
      if (gold.propertyAttribution === 'shared') shared += 1;
      if (model === null) continue;
      totalCells += 1;
      evaluatedProperties.add(entry.candidateId);
      const prediction = predictions.get(`${entry.evidenceId}:${feature}`);
      const positive = prediction?.visibility === 'clear';
      const negative = prediction?.visibility === 'not_visible';
      if (!positive && !negative) abstentions += 1;
      if (positive && !['clear', 'not_visible'].includes(gold.visibility)) unresolvedPositives += 1;
      if (gold.visibility === 'clear') {
        if (positive) tp += 1;
        else fn += 1;
      }
      if (gold.visibility === 'not_visible') {
        if (positive) fp += 1;
        else tn += 1;
      }
      const conditions = imageReviews.get(entry.evidenceId) ?? [];
      if (conditions.some((review) => review.conditions.length > 0)) {
        difficult += 1;
        if (positive) difficultPositivePredictions += 1;
        if (positive && gold.visibility !== 'clear') difficultErrors += 1;
      }
      if (prediction !== undefined) {
        if (prediction.propertyAttribution !== 'unknown') {
          attributablePredictions += 1;
          if (prediction.propertyAttribution === gold.propertyAttribution) correctAttributions += 1;
          else wrongAttributions += 1;
        }
        const category = comparisonCategory(
          feature,
          prediction.visibility,
          gold.propertyAttribution,
          textClaims.filter((claim) => claim.candidateId === entry.candidateId),
        );
        comparisons[category] = (comparisons[category] ?? 0) + 1;
        if (
          positive &&
          gold.visibility === 'clear' &&
          gold.propertyAttribution === 'belongs_to_candidate' &&
          category === 'new_visual_observation_review_pending' &&
          conditions.length >= 2 &&
          conditions.every(
            (review) => review.expectedProperty === 'yes' && review.scene === 'photograph',
          )
        )
          validatedGain.add(`${entry.candidateId}:${feature}`);
      }
    }
    const precision = proportion(tp, tp + fp);
    const recall = proportion(tp, tp + fn);
    return {
      feature,
      independentlyAgreedCells: reviewed,
      truePositive: tp,
      falsePositive: fp,
      falseNegative: fn,
      trueNegative: tn,
      precision,
      recall,
      f1: 2 * tp + fp + fn === 0 ? null : Number(((2 * tp) / (2 * tp + fp + fn)).toFixed(4)),
      falsePositiveRate: proportion(fp, fp + tn),
      falseNegativeRate: proportion(fn, fn + tp),
      abstentionRate: proportion(abstentions, model === null ? 0 : reviewed),
      unsupportedClearObservationRate: proportion(
        fp + unresolvedPositives,
        tp + fp + unresolvedPositives,
      ),
      unresolvedPositivePredictions: unresolvedPositives,
      difficultCases: difficult,
      difficultUnsupportedPositiveRate: proportion(difficultErrors, difficultPositivePredictions),
      promotion: 'not_established',
    };
  });
  const costs = model?.results.map((result) => result.cost) ?? [];
  const currency = costs[0]?.currency;
  const costKnown =
    costs.length > 0 &&
    currency !== undefined &&
    costs.every((cost) => cost?.currency === currency);
  const totalCost = costKnown ? costs.reduce((sum, cost) => sum + (cost?.amount ?? 0), 0) : null;
  return {
    reportVersion: 'grp-visual-evaluation@1',
    corpusManifestSha256: corpus.manifestSha256,
    images: corpus.entries.length,
    holdoutImages: corpus.entries.filter((entry) => entry.partition === 'holdout').length,
    annotationStatus:
      sheets.length < 2 ||
      paired.length <
        corpus.entries.filter((entry) => entry.partition === 'holdout').length *
          VISUAL_FEATURES.length
        ? 'incomplete_independent_annotation'
        : disagreements > 0
          ? 'adjudication_required_disagreements_excluded'
          : 'double_annotation_available',
    independentReviewers: sheets.length,
    doubleReviewedHoldoutCells: paired.length,
    disagreements,
    agreement: { pairedCells: paired.length, kappa: cohensKappa(paired) },
    visionStatus: model === null ? 'not_executed' : 'captured_run',
    scoredCells: totalCells,
    perFeature,
    grounding: {
      attemptedOutputs: model?.results.length ?? 0,
      acceptedOutputs: model?.results.filter((result) => result.accepted !== null).length ?? 0,
      structuredOutputValidity: proportion(
        model?.results.filter((result) => result.structuredValid).length ?? 0,
        model?.results.length ?? 0,
      ),
      rejectedOutputs: model?.results.filter((result) => result.accepted === null).length ?? 0,
      errors: model?.results.flatMap((result) => result.errors) ?? [],
    },
    attribution: {
      correct: proportion(correctAttributions, attributablePredictions),
      wrong: proportion(wrongAttributions, attributablePredictions),
      sharedFacilityAgreedCells: shared,
      unsupportedPropertyAssertionsRejected:
        model?.results.filter((result) =>
          result.errors.includes('visual.unsupported_property_attribution'),
        ).length ?? 0,
      propertyClaimsWritten: 0,
    },
    textBaseline: {
      claims: textClaims.length,
      authority: 'proposed_unverified_not_independent_ground_truth',
      visualModelCalls: 0,
      visualFacts: 0,
    },
    comparisons,
    incrementalKnowledge: {
      independentlyValidatedNewPropertyAttributes: totalCells === 0 ? null : validatedGain.size,
      validatedGainPerEvaluatedProperty:
        totalCells === 0 ? null : validatedGain.size / evaluatedProperties.size,
    },
    economics: {
      observedModelCalls: model?.results.length ?? 0,
      latencyMs: model?.results.reduce((sum, result) => sum + result.latencyMs, 0) ?? null,
      costs,
      costPerValidatedNewAttribute:
        totalCost !== null && validatedGain.size > 0
          ? { amount: totalCost / validatedGain.size, currency }
          : null,
      reason:
        totalCost !== null && validatedGain.size > 0
          ? 'Observed captured run cost divided by distinct independently supported new attributes; includes development processing'
          : 'No comparable observed currency cost and independently validated gain established',
    },
    decision: 'investigate_further',
    automation: [],
    limitations: [
      'Tiny source-linked convenience census, not representative national coverage',
      'No property assertions are permitted by the adapter',
      'Text Claims are proposed, not independently verified',
      'Disagreements require separate adjudication and a versioned annotation revision; they are never silently accepted',
      'No feature can advance without at least 20 independent positive and 20 negative holdout examples and accepted risk thresholds',
    ],
  };
}
