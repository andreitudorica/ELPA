import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { IMAGE_PROCESSING_VERSION } from './integrity';
import { featureSchema, VISUAL_SPEC_VERSION, UNCERTAIN_VISUAL_FEATURES } from './specification';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const rightsSchema = z
  .object({
    access: z.literal(true),
    download: z.literal(true),
    retain: z.literal(true),
    localAnalysis: z.literal(true),
    thirdPartyAnalysis: z.literal('requires_explicit_authorization'),
    publication: z.literal('not_authorized_by_experiment'),
    licence: z.literal('CC BY-SA 4.0'),
    licenceUrl: z.literal('https://creativecommons.org/licenses/by-sa/4.0/'),
    credit: z.string().min(1),
    permissionSource: z.url(),
    checkedAt: z.iso.datetime(),
  })
  .strict();
export const imageSchema = z
  .object({
    kind: z.literal('authorized_image@1'),
    title: z.string().startsWith('File:'),
    sourcePage: z.url(),
    imageUrl: z.url(),
    sourceVersion: z.string(),
    sourceSha1: z.string().regex(/^[a-f0-9]{40}$/),
    sha256: hash,
    byteSize: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.enum(['jpeg', 'png', 'webp']),
    dHash: z.string().regex(/^[a-f0-9]{16}$/),
    previewSha256: hash,
    processingVersion: z.literal(IMAGE_PROCESSING_VERSION),
    retrievedAt: z.iso.datetime(),
    captureDate: z.string().nullable(),
    caption: z.string(),
    relationshipContext: z.string(),
    relationship: z.literal('source_tag_reference'),
    attributionReview: z.literal('unreviewed'),
    privacyReview: z.literal('not_cleared_for_external_processing'),
    rights: rightsSchema,
  })
  .strict();
export type ImageEvidencePayload = z.infer<typeof imageSchema>;

export const imageEntrySchema = z
  .object({
    candidateId: z.uuid(),
    sourceEvidenceId: z.uuid(),
    sourceEvidenceSha256: hash,
    sourceRecordKey: z.string(),
    countyCode: z.string().nullable(),
    evidenceId: z.uuid(),
    artifactId: z.uuid(),
    image: imageSchema,
    partition: z.enum(['development', 'holdout']),
    group: z.string(),
  })
  .strict();
export type VisualEntry = z.infer<typeof imageEntrySchema>;

export const regionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (box) => box.x + box.width <= 1 && box.y + box.height <= 1,
    'Region exceeds image bounds',
  );
export const observationSchema = z
  .object({
    feature: featureSchema,
    evidenceId: z.uuid(),
    imageSha256: hash,
    visibility: z.enum(['clear', 'partial', 'not_visible', 'uncertain']),
    region: regionSchema.nullable(),
    directObservation: z.literal(true),
    uncertainty: z.enum(['none', 'occluded', 'ambiguous_scene', 'low_quality']),
    propertyAttribution: z.enum([
      'unknown',
      'nearby',
      'shared',
      'unrelated',
      'belongs_to_candidate',
    ]),
    contextSpan: z
      .object({
        field: z.enum(['caption', 'relationshipContext']),
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
        quote: z.string().min(1),
      })
      .strict()
      .nullable(),
    propertyAssertion: z.literal(false),
  })
  .strict();
export type VisualObservation = z.infer<typeof observationSchema>;
export const imageAnnotationLocatorSchema = z
  .object({
    type: z.literal('image_annotation'),
    imageSha256: hash,
    specificationVersion: z.string(),
    model: z.string(),
    modelVersion: z.string(),
    promptVersion: z.string(),
    processingVersion: z.string(),
    processingTimestamp: z.iso.datetime(),
    region: regionSchema.nullable(),
    visibility: z.enum(['clear', 'partial', 'uncertain']),
    uncertainty: z.string(),
    propertyAttribution: z.enum(['unknown', 'nearby', 'shared', 'unrelated']),
    propertyAssertion: z.literal(false),
    evaluationStatus: z.literal('independent_review_pending'),
    scene: z.string(),
    sourceEvidenceId: z.uuid(),
  })
  .strict();
export const visionOutputSchema = z
  .object({
    specificationVersion: z.literal(VISUAL_SPEC_VERSION),
    evidenceId: z.uuid(),
    imageSha256: hash,
    processingVersion: z.literal(IMAGE_PROCESSING_VERSION),
    scene: z.enum(['photograph', 'possible_rendering', 'stock_or_promotional', 'unknown']),
    observations: z.array(observationSchema).max(30),
    uncertainSuggestions: z.array(z.enum(UNCERTAIN_VISUAL_FEATURES)),
    abstentionReason: z.string().nullable(),
  })
  .strict();
export type VisionOutput = z.infer<typeof visionOutputSchema>;

export function validateVisualOutput(input: unknown, entry: VisualEntry) {
  const parsed = visionOutputSchema.safeParse(input);
  if (!parsed.success) return { accepted: null, errors: ['visual.output_schema'] };
  const output = parsed.data;
  const errors: string[] = [];
  if (output.evidenceId !== entry.evidenceId || output.imageSha256 !== entry.image.sha256)
    errors.push('visual.image_reference');
  const seen = new Set<string>();
  for (const observation of output.observations) {
    if (
      observation.evidenceId !== entry.evidenceId ||
      observation.imageSha256 !== entry.image.sha256
    )
      errors.push('visual.image_reference');
    if (seen.has(observation.feature)) errors.push('visual.duplicate_feature');
    seen.add(observation.feature);
    const span = observation.contextSpan;
    if (
      span !== null &&
      (span.start >= span.end || entry.image[span.field].slice(span.start, span.end) !== span.quote)
    )
      errors.push('visual.context_span');
    // Source association is unreviewed in this corpus. A detection cannot upgrade it.
    if (observation.propertyAttribution === 'belongs_to_candidate')
      errors.push('visual.unsupported_property_attribution');
    if (observation.propertyAttribution !== 'unknown' && span === null)
      errors.push('visual.attribution_context_missing');
    if (observation.visibility === 'clear' && observation.uncertainty !== 'none')
      errors.push('visual.inconsistent_visibility');
  }
  return { accepted: errors.length === 0 ? output : null, errors };
}

export function observationIdentity(observation: VisualObservation): string {
  return sha256Hex(
    canonicalJson([
      observation.evidenceId,
      observation.feature,
      observation.visibility,
      observation.propertyAttribution,
    ]),
  );
}
