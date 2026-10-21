import { createHash } from 'node:crypto';

import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { AcquisitionRunSchema, CandidateSummarySchema } from '../dto/acquisition.dto';
import { privateDirectory } from '../extraction/files';
import { persistVisualObservations } from '../visual-persistence';
import { commonsPermission } from './commons';
import { imageSchema, validateVisualOutput, visionOutputSchema } from './contracts';
import type { VisualEntry } from './contracts';
import { partitionImages, VISUAL_CORPUS_VERSION } from './corpus';
import type { VisualCorpus } from './corpus';
import {
  annotationSchema,
  annotationTemplate,
  comparisonCategory,
  evaluateVisual,
} from './evaluation';
import { imagePath } from './files';
import {
  hammingDistance,
  IMAGE_PROCESSING_VERSION,
  inspectImage,
  MAX_IMAGE_BYTES,
} from './integrity';
import { VISUAL_FEATURES, VISUAL_SPEC_VERSION, visualSpecification } from './specification';
import { importVisionCapture, VISION_PROMPT, VISION_PROMPT_VERSION } from './vision';

const id = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const hash = 'a'.repeat(64);
const time = '2026-10-21T12:00:00Z';

function entry(n = 1): VisualEntry {
  return {
    candidateId: id(n),
    sourceEvidenceId: id(n + 100),
    sourceEvidenceSha256: hash,
    sourceRecordKey: `way/synthetic-${String(n)}`,
    countyCode: 'RO-CS',
    evidenceId: id(n + 200),
    artifactId: id(n + 300),
    partition: 'holdout',
    group: `synthetic-${String(n)}`,
    image: imageSchema.parse({
      kind: 'authorized_image@1',
      title: `File:Synthetic ${String(n)}.jpg`,
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Synthetic.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Synthetic.jpg',
      sourceVersion: 'synthetic@1',
      sourceSha1: 'b'.repeat(40),
      sha256: hash,
      byteSize: 100,
      width: 128,
      height: 96,
      format: 'jpeg',
      dHash: '0000000000000000',
      previewSha256: 'c'.repeat(64),
      processingVersion: IMAGE_PROCESSING_VERSION,
      retrievedAt: time,
      captureDate: null,
      caption: 'Piscină publică la 300 m.',
      relationshipContext: 'Unreviewed source link',
      relationship: 'source_tag_reference',
      attributionReview: 'unreviewed',
      privacyReview: 'not_cleared_for_external_processing',
      rights: {
        access: true,
        download: true,
        retain: true,
        localAnalysis: true,
        thirdPartyAnalysis: 'requires_explicit_authorization',
        publication: 'not_authorized_by_experiment',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        credit: 'Synthetic author',
        permissionSource: 'https://commons.wikimedia.org/wiki/File:Synthetic.jpg',
        checkedAt: time,
      },
    }),
  };
}
function output(e = entry()) {
  return visionOutputSchema.parse({
    specificationVersion: VISUAL_SPEC_VERSION,
    evidenceId: e.evidenceId,
    imageSha256: e.image.sha256,
    processingVersion: IMAGE_PROCESSING_VERSION,
    scene: 'photograph',
    observations: [
      {
        feature: 'pool',
        evidenceId: e.evidenceId,
        imageSha256: e.image.sha256,
        visibility: 'clear',
        region: null,
        directObservation: true,
        uncertainty: 'none',
        propertyAttribution: 'nearby',
        contextSpan: {
          field: 'caption',
          start: 0,
          end: e.image.caption.length,
          quote: e.image.caption,
        },
        propertyAssertion: false,
      },
    ],
    uncertainSuggestions: [],
    abstentionReason: null,
  });
}
function corpus(entries = [entry()]): VisualCorpus {
  return { version: VISUAL_CORPUS_VERSION, campaignId: id(900), entries, manifestSha256: hash };
}
function capture() {
  const e = entry();
  return {
    kind: 'captured_vision_run@1',
    corpusManifestSha256: hash,
    specificationVersion: VISUAL_SPEC_VERSION,
    provider: 'synthetic',
    model: 'synthetic',
    modelVersion: '1',
    promptVersion: VISION_PROMPT_VERSION,
    promptSha256: sha256Hex(VISION_PROMPT),
    parameters: {},
    authorizationReference: 'synthetic test authorization',
    transferPermissionReference: 'synthetic test permission',
    privacyReviews: [
      {
        imageSha256: e.image.sha256,
        reviewedPreviewSha256: e.image.previewSha256,
        reviewer: 'synthetic reviewer',
        noUnnecessaryPersonalData: true,
        reviewedAt: time,
      },
    ],
    runType: 'captured_offline',
    executedAt: time,
    outputs: [
      {
        evidenceId: e.evidenceId,
        output: output(e),
        latencyMs: 10,
        inputTokens: null,
        outputTokens: null,
        cost: { amount: 0.01, currency: 'EUR' },
      },
    ],
  };
}
function labels(reviewer: string) {
  return {
    version: 'grp-visual-annotation@1',
    specificationVersion: VISUAL_SPEC_VERSION,
    corpusManifestSha256: hash,
    reviewer,
    role: 'independent_human',
    independentlyCompleted: true,
    reviewedAt: time,
    images: [
      {
        evidenceId: entry().evidenceId,
        imageSha256: hash,
        expectedProperty: 'yes',
        scene: 'photograph',
        conditions: ['nearby_attraction'],
        cells: VISUAL_FEATURES.map((feature) => ({
          feature,
          visibility: feature === 'pool' ? 'clear' : 'not_visible',
          region: null,
          propertyAttribution: 'nearby',
          attributionEvidence: 'Synthetic exact nearby caption',
          ambiguity: '',
          availability: 'not_established_by_photo',
        })),
      },
    ],
  };
}

describe('bounded visual integrity', () => {
  it('rejects invalid, oversized, unsupported and corrupt images before interpretation', async () => {
    await expect(inspectImage(Buffer.from('<svg>unsafe</svg>'))).rejects.toThrow(
      'image.unsupported_type',
    );
    await expect(inspectImage(Buffer.alloc(MAX_IMAGE_BYTES + 1))).rejects.toThrow(
      'image.byte_limit',
    );
    await expect(inspectImage(Buffer.from([255, 216, 255, 0]))).rejects.toThrow(
      'image.decode_failed',
    );
    const tiny = await sharp({
      create: { width: 16, height: 16, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    await expect(inspectImage(tiny)).rejects.toThrow('image.too_small');
  });

  it('decodes originals, normalizes orientation, strips preview metadata and detects re-encoded duplicates', async () => {
    const pixels = Buffer.from(
      Array.from({ length: 96 * 64 * 3 }, (_, i) => (Math.floor(i / 3) % 96) * 2),
    );
    const png = await sharp(pixels, { raw: { width: 96, height: 64, channels: 3 } })
      .png()
      .toBuffer();
    const jpeg = await sharp(png).jpeg({ quality: 95 }).toBuffer();
    const first = await inspectImage(png);
    const second = await inspectImage(jpeg);
    expect(first.sha256).toBe(sha256Hex(png));
    expect(first.sha256).not.toBe(second.sha256);
    expect(hammingDistance(first.dHash, second.dHash)).toBeLessThanOrEqual(6);
    expect(await inspectImage(png)).toEqual(first);
    const rotated = await inspectImage(
      await sharp(png).withMetadata({ orientation: 6 }).jpeg().toBuffer(),
    );
    expect([rotated.width, rotated.height]).toEqual([64, 96]);
    expect((await sharp(rotated.preview).metadata()).exif).toBeUndefined();
    expect(createHash('sha256').update(rotated.preview).digest('hex')).toBe(rotated.previewSha256);
  });

  it('groups exact, near-duplicate and matcher-linked images for splitting without merging identities', () => {
    const a = entry(1);
    const b = entry(2);
    const c = entry(3);
    b.image = { ...b.image, sha256: 'b'.repeat(64), dHash: '0000000000000001' };
    c.image = { ...c.image, sha256: 'c'.repeat(64), dHash: 'ffffffffffffffff' };
    const grouped = partitionImages([a, b, c], [], []);
    expect(grouped.nearDuplicatePairs).toBe(1);
    expect(new Set(grouped.entries.slice(0, 2).map((row) => row.partition)).size).toBe(1);
    expect(grouped.entries.map((row) => row.candidateId)).toEqual([
      a.candidateId,
      b.candidateId,
      c.candidateId,
    ]);
    expect(
      partitionImages(
        [a, b, c],
        [],
        [{ left: a.sourceRecordKey, right: c.sourceRecordKey, relation: 'same_property' }],
      ).groupCount,
    ).toBe(1);
    expect(partitionImages([a, entry(2)], [], []).exactDuplicates).toBe(1);
  });

  it('separates copyright permission, third-party transfer and public publication, and rejects other hosts', () => {
    const info = {
      url: entry().image.imageUrl,
      descriptionurl: entry().image.sourcePage,
      sha1: 'b'.repeat(40),
      timestamp: time,
      size: 100,
      width: 100,
      height: 100,
      mime: 'image/jpeg',
      extmetadata: {
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
        Artist: { value: 'Synthetic' },
      },
    };
    expect(commonsPermission(info).licence).toBe('CC BY-SA 4.0');
    expect(() => commonsPermission({ ...info, url: 'https://example.com/photo.jpg' })).toThrow(
      'image.source_host',
    );
    expect(() => commonsPermission({ ...info, extmetadata: {} })).toThrow(
      'image.permission_not_established',
    );
    expect(
      imageSchema.safeParse({
        ...entry().image,
        rights: { ...entry().image.rights, thirdPartyAnalysis: true },
      }).success,
    ).toBe(false);
    expect(() => imagePath('../private')).toThrow();
    expect(() => privateDirectory('/tmp/public-images')).toThrow();
  });
});

describe('image grounding and Research authority', () => {
  it('rejects malformed schema, region, evidence, scope, context and unsupported property attribution', () => {
    const e = entry();
    const valid = output(e);
    const observation = valid.observations[0];
    if (observation === undefined) throw new Error('Missing synthetic observation');
    expect(validateVisualOutput(valid, e).errors).toEqual([]);
    expect(validateVisualOutput({ ...valid, evidenceId: id(999) }, e).errors).toContain(
      'visual.image_reference',
    );
    expect(
      validateVisualOutput(
        {
          ...valid,
          observations: [{ ...observation, propertyAttribution: 'belongs_to_candidate' }],
        },
        e,
      ).errors,
    ).toContain('visual.unsupported_property_attribution');
    expect(
      validateVisualOutput(
        { ...valid, observations: [{ ...observation, propertyAssertion: true }] },
        e,
      ).accepted,
    ).toBeNull();
    expect(
      validateVisualOutput(
        { ...valid, observations: [{ ...observation, feature: 'private_event_permission' }] },
        e,
      ).accepted,
    ).toBeNull();
    expect(
      validateVisualOutput(
        {
          ...valid,
          observations: [{ ...observation, region: { x: 0.9, y: 0, width: 0.2, height: 0.1 } }],
        },
        e,
      ).accepted,
    ).toBeNull();
    expect(
      validateVisualOutput(
        {
          ...valid,
          observations: [
            { ...observation, contextSpan: { field: 'caption', start: 0, end: 4, quote: 'pool' } },
          ],
        },
        e,
      ).errors,
    ).toContain('visual.context_span');
  });

  it('requires authorized privacy-cleared inputs and versions cache identity when a model changes', () => {
    const first = importVisionCapture(capture(), corpus());
    expect(first.results[0]?.accepted).not.toBeNull();
    expect(importVisionCapture({ ...capture(), modelVersion: '2' }, corpus()).method).not.toBe(
      first.method,
    );
    expect(
      importVisionCapture({ ...capture(), privacyReviews: [] }, corpus()).results[0]?.errors,
    ).toContain('visual.privacy_review_missing');
    expect(() =>
      importVisionCapture({ ...capture(), authorizationReference: '' }, corpus()),
    ).toThrow();
    expect(() => importVisionCapture({ ...capture(), promptSha256: 'changed' }, corpus())).toThrow(
      'Vision input or prompt mismatch',
    );
  });

  it('persists image-level proposed observations with audit history, and repeats without adding Claims', async () => {
    const imported = importVisionCapture(capture(), corpus());
    const keys = new Set<string>();
    const storeClaims = vi.fn(
      (
        _run: string,
        _observed: Date,
        claims: {
          target: string;
          value: unknown;
          evidenceLocator: unknown;
          extractionMethod: string;
        }[],
      ) => {
        let created = 0;
        for (const claim of claims) {
          const key = canonicalJson(claim);
          if (!keys.has(key)) {
            keys.add(key);
            created += 1;
          }
        }
        return Promise.resolve(created);
      },
    );
    const ports = {
      storeClaims,
      storeRunRecords: vi.fn(() => Promise.resolve(undefined)),
      finishRun: vi.fn(() => Promise.resolve(undefined)),
    };
    const audit = { record: vi.fn(() => Promise.resolve(undefined)) };
    const input = {
      entry: entry(),
      output: output(),
      metadata: imported.metadata,
      method: imported.method,
      runId: id(700),
      administratorId: id(701),
    };
    expect((await persistVisualObservations(input, ports, audit)).claimsCreated).toBe(1);
    expect((await persistVisualObservations(input, ports, audit)).claimsCreated).toBe(0);
    expect(storeClaims.mock.calls[0]?.[2][0]?.target).toBe('image.visible.pool');
    expect(audit.record).toHaveBeenCalledTimes(2);
    await expect(
      persistVisualObservations(
        { ...input, output: { ...input.output, imageSha256: 'b'.repeat(64) } },
        ports,
        audit,
      ),
    ).rejects.toThrow('Invalid visual grounding');
    expect(storeClaims).toHaveBeenCalledTimes(2);
  });

  it('keeps seasonal text compatible, preserves possible conflicts and refuses silent property promotion', () => {
    expect(
      comparisonCategory('pool', 'clear', 'belongs_to_candidate', [
        { target: 'offer.pool', value: true },
        { target: 'offer.pool_season', value: 'summer' },
      ]),
    ).toBe('consistent_with_proposed_text');
    expect(
      comparisonCategory('pool', 'clear', 'belongs_to_candidate', [
        { target: 'offer.pool', value: false },
      ]),
    ).toBe('potential_conflict_requires_review');
    expect(comparisonCategory('pool', 'clear', 'nearby', [])).toBe('irrelevant_to_property');
    expect(comparisonCategory('pool', 'clear', 'unknown', [])).toBe('cannot_attribute_to_property');
    expect(
      comparisonCategory('lawn', 'clear', 'belongs_to_candidate', [
        { target: 'offer.terrain', value: 'sloped' },
      ]),
    ).toBe('new_visual_observation_review_pending');
    expect(CandidateSummarySchema.shape.verificationStatus.safeParse('verified').success).toBe(
      false,
    );
    expect(AcquisitionRunSchema.shape.sourceKey.safeParse('wikimedia_commons_images').success).toBe(
      true,
    );
    expect(
      CandidateSummarySchema.shape.sourceKey.safeParse('wikimedia_commons_images').success,
    ).toBe(false);
    expect(visualSpecification().prohibited).toContain('private_event_permission');
  });
});

describe('independent evaluation protocol (synthetic labels only)', () => {
  it('reports unavailable metrics as null and prevents blank annotation templates from passing as reviews', () => {
    const report = evaluateVisual(corpus(), [], null, []);
    expect(report.annotationStatus).toBe('incomplete_independent_annotation');
    expect(report.perFeature[0]?.precision.value).toBeNull();
    expect(report.incrementalKnowledge.independentlyValidatedNewPropertyAttributes).toBeNull();
    expect(annotationSchema.safeParse(annotationTemplate(corpus())).success).toBe(false);
  });

  it('scores detection separately from property attribution and rejects reviewer identity reuse', () => {
    const run = importVisionCapture(capture(), corpus());
    const report = evaluateVisual(corpus(), [labels('reviewer-a'), labels('reviewer-b')], run, []);
    expect(report.perFeature.find((row) => row.feature === 'pool')?.precision.value).toBe(1);
    expect(report.attribution.correct.value).toBe(1);
    expect(report.incrementalKnowledge.independentlyValidatedNewPropertyAttributes).toBe(0);
    expect(report.comparisons.irrelevant_to_property).toBe(1);
    expect(() => evaluateVisual(corpus(), [labels('same'), labels('same')], run, [])).toThrow(
      'Duplicate independent reviewer',
    );
    const disagreed = labels('reviewer-c');
    const first = disagreed.images[0]?.cells[0];
    if (first !== undefined) first.visibility = 'not_visible';
    expect(evaluateVisual(corpus(), [labels('reviewer-a'), disagreed], run, []).disagreements).toBe(
      1,
    );
  });

  it('reports zero F1 for false detections and missed facts, and refuses empty reviews', () => {
    const e = entry();
    const original = output(e);
    const observation = original.observations[0];
    if (observation === undefined) throw new Error('Missing synthetic observation');
    const captured = capture();
    const result = captured.outputs[0];
    if (result === undefined) throw new Error('Missing synthetic result');
    const run = importVisionCapture(
      {
        ...captured,
        outputs: [
          {
            ...result,
            output: { ...original, observations: [{ ...observation, feature: 'gazebo' }] },
          },
        ],
      },
      corpus(),
    );
    const report = evaluateVisual(corpus(), [labels('a'), labels('b')], run, []);
    expect(report.perFeature.find((row) => row.feature === 'pool')?.f1).toBe(0);
    expect(report.perFeature.find((row) => row.feature === 'gazebo')?.falsePositive).toBe(1);
    expect(report.perFeature.find((row) => row.feature === 'gazebo')?.f1).toBe(0);
    expect(
      evaluateVisual(
        corpus(),
        [
          { ...labels('a'), images: [] },
          { ...labels('b'), images: [] },
        ],
        run,
        [],
      ).annotationStatus,
    ).toBe('incomplete_independent_annotation');
  });
});
