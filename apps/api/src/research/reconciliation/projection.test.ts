import { expect, it } from 'vitest';

import { sha256Hex } from '../acquisition/source-record';
import { documentFromEvidence } from '../extraction/documents';
import { projectClaim, type RetainedClaim } from './projection';
import { uuid } from './fixtures';

function retained(): RetainedClaim {
  const date = new Date('2026-10-20T00:00:00.000Z');
  return {
    id: uuid(1),
    candidateId: uuid(100),
    evidenceId: uuid(200),
    target: 'offer.sleeps_persons',
    value: 16,
    evidenceLocator: { type: 'structured_field', fields: ['Număr locuri'] },
    extractionMethod: 'situr-accommodation-normalizer@1',
    observedAt: date,
    createdAt: date,
    latestEvidenceId: uuid(200),
    candidateSourceKey: 'situr_accommodation_register',
    candidateSourceRecordKey: 'synthetic',
    evidence: {
      id: uuid(200),
      sourceKey: 'situr_accommodation_register',
      sourceRecordKey: 'synthetic',
      sourceRecordUrl: null,
      payload: { 'Număr locuri': '16' },
      contentSha256: sha256Hex('synthetic'),
      observedAt: date,
      createdAt: date,
      artifactId: uuid(300),
      artifactSha256: sha256Hex('artifact'),
      sourceVersion: 'synthetic@1',
      retrievedAt: date,
      reuseTerms: 'ro_public_register_no_explicit_licence',
      retentionPolicy: 'personal_data_redacted',
    },
  };
}
it('preserves official classification context without inventing validity or publication dates', () => {
  const projected = projectClaim(retained());
  expect(projected?.qualifiers.capacityBasis).toBe('official_classified');
  expect(projected?.evidence.grounding).toBe('valid');
  expect(projected?.validity).toEqual({ from: null, until: null });
  expect(projected?.sourcePublishedAt).toBeNull();
  expect(projected?.evidence.passageFingerprint).toBeNull();
});
it('detects invalid structured fields and text span references, retaining superseded methods', () => {
  const row = retained();
  row.evidenceLocator = { type: 'structured_field', fields: ['wrong'] };
  expect(projectClaim(row)?.evidence.grounding).toBe('invalid');
  row.extractionMethod = 'grp-text-rules@1';
  const document = documentFromEvidence({
    ...row.evidence,
    candidateId: row.candidateId,
    evidenceId: row.evidenceId,
  });
  row.evidenceLocator = {
    type: 'text_span',
    ontologyVersion: 'grp-attributes@1',
    documentId: document.id,
    sourceVersion: document.sourceVersion,
    textSha256: document.textSha256,
    fieldPath: ['Număr locuri'],
    start: 0,
    end: 2,
    quote: '99',
    explicitness: 'explicit_positive',
    entityLevel: 'offer',
    scope: 'advertised_accommodation',
    temporal: { kind: 'unspecified', text: null },
    ambiguity: 'none',
    evaluationStatus: 'independent_review_pending',
    grounding: 'technically_validated',
  };
  expect(projectClaim(row)).toMatchObject({
    methodStatus: 'superseded',
    evidence: { grounding: 'invalid' },
  });
});

it('rejects technically readable evidence associated with the wrong source Candidate', () => {
  const row = retained();
  row.candidateSourceRecordKey = 'different-property';
  expect(projectClaim(row)?.evidence.grounding).toBe('invalid');
});
