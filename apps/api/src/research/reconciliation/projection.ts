import { z } from 'zod';

import type { JsonObject, JsonValue, EvidenceLocator } from '../acquisition/source-record';
import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { CURRENT_EXTRACTION_METHODS } from '../acquisition/sources';
import { documentFromEvidence } from '../extraction/documents';
import { validateFact } from '../extraction/contracts';
import { attributeSchema, propositionSchema, type Proposition } from './contracts';

export interface RetainedClaim {
  id: string;
  candidateId: string;
  evidenceId: string;
  target: string;
  value: JsonValue;
  evidenceLocator: EvidenceLocator;
  extractionMethod: string;
  observedAt: Date;
  createdAt: Date;
  latestEvidenceId: string;
  candidateSourceKey: string;
  candidateSourceRecordKey: string;
  evidence: {
    id: string;
    sourceKey: string;
    sourceRecordKey: string;
    sourceRecordUrl: string | null;
    payload: JsonObject;
    contentSha256: string;
    observedAt: Date;
    createdAt: Date;
    artifactId: string;
    artifactSha256: string;
    sourceVersion: string | null;
    retrievedAt: Date;
    reuseTerms: string;
    retentionPolicy: string;
  };
}

/** Missing context is preserved as unknown; extraction timestamps never become validity. */
export function projectClaim(row: RetainedClaim): Proposition | null {
  const parsedAttribute = attributeSchema.safeParse(
    row.target.replace(/^(?:offer\.|image\.visible\.)/, ''),
  );
  if (!parsedAttribute.success || !['string', 'number', 'boolean'].includes(typeof row.value))
    return null;
  const attribute = parsedAttribute.data;
  const locator = row.evidenceLocator;
  const document =
    row.evidence.sourceKey === 'wikimedia_commons_images'
      ? null
      : documentFromEvidence({
          ...row.evidence,
          candidateId: row.candidateId,
          evidenceId: row.evidenceId,
        });
  let grounding: Proposition['evidence']['grounding'] = 'unvalidated';
  let quote: string | null = null;
  let passageFingerprint: string | null = null;
  let official = false;
  if (locator.type === 'text_span' && document !== null) {
    // The stored locator also contains persistence metadata; validate the exact fact projection.
    grounding =
      validateFact(
        {
          attribute,
          value: row.value,
          documentId: locator.documentId,
          evidenceId: row.evidenceId,
          sourceVersion: locator.sourceVersion,
          textSha256: locator.textSha256,
          fieldPath: locator.fieldPath,
          start: locator.start,
          end: locator.end,
          quote: locator.quote,
          explicitness: locator.explicitness,
          entityLevel: locator.entityLevel,
          scope: locator.scope,
          temporal: locator.temporal,
          ambiguity: locator.ambiguity,
        },
        document,
      ).length === 0
        ? 'valid'
        : 'invalid';
    quote = locator.quote;
    passageFingerprint = sha256Hex(quote);
    official =
      row.evidence.sourceKey === 'situr_accommodation_register' &&
      locator.fieldPath.join('.') === 'Număr locuri';
  } else if (locator.type === 'structured_field' && document !== null) {
    const selected = document.fields.filter((field) =>
      locator.fields.includes(field.path.join('.')),
    );
    if (selected.length === locator.fields.length && selected.length > 0) {
      quote = selected.map((field) => field.text).join('\n');
      // A bare numeric quote must not correlate unrelated properties with the same capacity.
      passageFingerprint = null;
      const number = Number(quote.replace(/\s/g, ''));
      grounding =
        typeof row.value === 'number' && Number.isFinite(number) && number === row.value
          ? 'valid'
          : 'unvalidated';
      official =
        row.evidence.sourceKey === 'situr_accommodation_register' &&
        locator.fields.includes('Număr locuri');
    } else grounding = 'invalid';
  }
  if (quote !== null && quote.length < 80) passageFingerprint = null;
  if (
    row.evidence.id !== row.evidenceId ||
    (locator.type !== 'image_annotation' &&
      (row.candidateSourceKey !== row.evidence.sourceKey ||
        row.candidateSourceRecordKey !== row.evidence.sourceRecordKey))
  )
    grounding = 'invalid';
  const current =
    row.evidenceId === row.latestEvidenceId &&
    (CURRENT_EXTRACTION_METHODS as readonly string[]).includes(row.extractionMethod);
  return propositionSchema.parse({
    claimId: row.id,
    candidateId: row.candidateId,
    evidenceId: row.evidenceId,
    entityLevel: locator.type === 'image_annotation' ? 'image' : 'offer',
    scope: locator.type === 'image_annotation' ? 'image_visible' : 'advertised_accommodation',
    attribute,
    value: row.value,
    unit:
      attribute === 'yard_area_m2'
        ? 'm2'
        : attribute === 'beds_count'
          ? 'beds'
          : ['sleeps_persons', 'max_daytime_guests'].includes(attribute)
            ? 'persons'
            : null,
    qualifiers: {
      capacityBasis: official
        ? 'official_classified'
        : attribute === 'beds_count'
          ? 'beds'
          : 'unknown',
      access: 'unknown',
      months: null,
      approximate: locator.type === 'text_span' && locator.ambiguity === 'approximate',
      ambiguous:
        locator.type === 'text_span' &&
        (locator.ambiguity !== 'none' || locator.temporal.kind !== 'unspecified'),
    },
    validity: { from: null, until: null },
    observedAt: row.observedAt.toISOString(),
    acquiredAt: row.evidence.retrievedAt.toISOString(),
    sourcePublishedAt: null,
    extractedAt: row.createdAt.toISOString(),
    method: row.extractionMethod,
    methodStatus: current ? 'current' : 'superseded',
    explicitness:
      locator.type === 'inferred'
        ? 'inferred'
        : locator.type === 'image_annotation'
          ? 'unknown'
          : 'explicit',
    evidence: {
      sourceKey: row.evidence.sourceKey,
      sourceRecordKey: row.evidence.sourceRecordKey,
      sourceVersion: row.evidence.sourceVersion ?? 'unknown',
      contentSha256: row.evidence.contentSha256,
      originalId: `${row.evidence.sourceKey}:${row.evidence.sourceRecordKey}`,
      passageFingerprint,
      quote,
      locator: z.record(z.string(), z.unknown()).parse(JSON.parse(canonicalJson(locator))),
      grounding,
    },
  });
}
