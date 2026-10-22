import { describe, expect, it } from 'vitest';

import type { EvidenceSnapshot, Subject } from './contracts';
import {
  AS_OF,
  COUNTIES,
  claim,
  evidence,
  osmCounty,
  registerLocality,
  textFacility,
  uuid,
} from './fixtures.test-support';
import { categorize } from './policy';
import { validate } from './validator';

const options = { asOf: AS_OF, counties: COUNTIES };
const withOwnEvidence = (
  subject: Subject,
  change: (evidence: EvidenceSnapshot) => EvidenceSnapshot,
): Subject => ({ ...subject, evidence: subject.evidence.map((e, i) => (i === 0 ? change(e) : e)) });
const status = (v: ReturnType<typeof validate>, id: string) =>
  v.checks.find((c) => c.id === id)?.status;

describe('categorize', () => {
  it('separates official classified places from advertised capacity', () => {
    const base = { target: 'offer.sleeps_persons', method: 'm', locatorType: 'structured_field' };
    expect(
      categorize({ ...base, sourceKey: 'situr_accommodation_register', fields: ['Număr locuri'] }),
    ).toBe('register_classified_capacity');
    expect(
      categorize({ ...base, sourceKey: 'osm_geofabrik_romania', fields: ['tags.capacity'] }),
    ).toBe('high_consequence');
  });

  it('keeps permissions and pool availability in the high-consequence category', () => {
    for (const attribute of ['parties_allowed', 'exclusive_rental', 'pool', 'max_daytime_guests'])
      expect(
        categorize({
          target: `offer.${attribute}`,
          sourceKey: 'osm_geofabrik_romania',
          method: 'grp-text-rules@2',
          locatorType: 'text_span',
          fields: ['tags.description'],
        }),
      ).toBe('high_consequence');
  });
});

describe('validate', () => {
  it('passes an explicit register locality in the latest register version', () => {
    const result = validate(registerLocality(), options);
    expect(result.outcome).toBe('passed');
    expect(result.proposition).toEqual({
      attribute: 'county_and_locality',
      value: { countyCode: 'RO-CJ', settlementName: 'Cluj-Napoca' },
    });
    expect(result.publicationConstraints).toContain('register_reuse_terms_pending_legal_review');
    expect(result.publicationConstraints).toContain('publication_workflow_not_implemented');
  });

  it('rejects an unknown county code and a missing settlement', () => {
    expect(validate(registerLocality({ countyCode: 'RO-ZZ' }), options).outcome).toBe('rejected');
    const missing = validate(registerLocality({ settlement: null }), options);
    expect(missing.outcome).toBe('rejected');
    expect(missing.reasons).toContain('value_normalized:settlement_missing');
  });

  it('accepts an empty optional locator field but not an empty carrying field', () => {
    const optional = registerLocality({
      claim: {
        locator: {
          type: 'structured_field',
          fields: ['Localitate', 'Județ', 'Tip localitate', 'Localitate componentă'],
        },
      },
    });
    const withEmpty = withOwnEvidence(optional, (e) => ({
      ...e,
      fields: [...e.fields, { path: ['Localitate componentă'], text: null, withheld: 'missing' }],
    }));
    expect(validate(withEmpty, options).outcome).toBe('passed');
    const emptyCounty = withOwnEvidence(withEmpty, (e) => ({
      ...e,
      fields: e.fields.map((f) =>
        f.path[0] === 'Județ' ? { ...f, text: null, withheld: 'missing' as const } : f,
      ),
    }));
    expect(validate(emptyCounty, options).outcome).toBe('rejected');
  });

  it('rejects a Claim whose structured field is not in the retained Evidence', () => {
    const subject = withOwnEvidence(registerLocality(), (e) => ({
      ...e,
      fields: e.fields.map((f) =>
        f.path[0] === 'Județ' ? { ...f, text: null, withheld: 'redacted' as const } : f,
      ),
    }));
    const result = validate(subject, options);
    expect(result.outcome).toBe('rejected');
    expect(status(result, 'source_reference_valid')).toBe('fail');
  });

  it('flags superseded Claims and defers outdated dataset versions', () => {
    expect(validate(registerLocality({ claim: { methodCurrent: false } }), options).outcome).toBe(
      'rejected',
    );
    const outdated = validate(
      registerLocality({ artifact: { latestDatasetVersion: '2026-11-21' } }),
      options,
    );
    expect(outdated.outcome).toBe('deferred');
    expect(outdated.reasons).toContain('temporal_context:outdated_dataset_version');
  });

  it('treats a disagreeing Claim on the same record as a contradiction', () => {
    const sibling = claim(
      'sibling',
      'register-candidate',
      'register-1',
      'offer.primary_locality',
      { countyCode: 'RO-BV', settlementName: 'Brașov' },
      { type: 'structured_field', fields: ['Localitate', 'Județ', 'Tip localitate'] },
    );
    const result = validate(registerLocality({ siblings: [sibling] }), options);
    expect(result.outcome).toBe('contradicted');
  });

  it('records an agreeing reprocessed copy as common origin, not independent support', () => {
    const copy = claim(
      'copy',
      'register-candidate',
      'register-1',
      'offer.primary_locality',
      { countyCode: 'RO-CJ', settlementName: 'Cluj-Napoca' },
      { type: 'structured_field', fields: ['Localitate', 'Județ', 'Tip localitate'] },
    );
    const result = validate(registerLocality({ siblings: [copy] }), options);
    expect(result.corroboration).toEqual([expect.objectContaining({ lineage: 'common_origin' })]);
  });

  it('defers an OSM county only when a more authoritative counterpart disagrees', () => {
    const registerEvidence = evidence('register-2', 'situr_accommodation_register', [
      ['Județ', 'BRASOV'],
    ]);
    const counterpartClaim = claim(
      'register-other',
      'register-other',
      'register-2',
      'offer.primary_locality',
      { countyCode: 'RO-BV', settlementName: 'Brașov' },
      { type: 'structured_field', fields: ['Județ'] },
    );
    const counterparts = [
      {
        suggestionId: uuid('suggestion'),
        strength: 'likely' as const,
        candidate: {
          id: uuid('register-other'),
          sourceKey: 'situr_accommodation_register',
          sourceRecordKey: 'record-register-2',
          displayName: 'Casa Test',
        },
        claims: [counterpartClaim],
      },
    ];
    const osm = validate(osmCounty({ counterparts, extraEvidence: [registerEvidence] }), options);
    expect(osm.outcome).toBe('deferred');
    expect(osm.conflicts[0]?.conditional).toBe(true);

    // The register is not deferred by a lower-authority conditional conflict.
    const osmEvidence = evidence('osm-9', 'osm_geofabrik_romania', [['lat', '1']]);
    const osmClaim = claim(
      'osm-other',
      'osm-other',
      'osm-9',
      'offer.primary_locality',
      { countyCode: 'RO-BV', settlementName: null },
      {
        type: 'inferred',
        policyId: 'osm-locality-inference@1',
        inputs: { countyBoundaryRelationId: 2 },
      },
      { method: 'osm-locality-inference@1' },
    );
    const register = validate(
      registerLocality({
        extraEvidence: [osmEvidence],
        counterparts: [
          {
            suggestionId: uuid('suggestion-2'),
            strength: 'possible',
            candidate: {
              id: uuid('osm-other'),
              sourceKey: 'osm_geofabrik_romania',
              sourceRecordKey: 'record-osm-9',
              displayName: 'Casa',
            },
            claims: [osmClaim],
          },
        ],
      }),
      options,
    );
    expect(register.outcome).toBe('passed');
    expect(register.conflicts).toHaveLength(1);
  });

  it('defers wording with a temporal qualifier or ambiguity', () => {
    const seasonal = validate(
      textFacility('sauna', 'saună', { temporal: { kind: 'seasonal', text: 'vara' } }),
      options,
    );
    expect(seasonal.outcome).toBe('deferred');
    const ungrounded = validate(
      textFacility('sauna', 'saună', {}, { grounding: 'invalid' }),
      options,
    );
    expect(ungrounded.outcome).toBe('rejected');
  });

  it('never permits model transfer of image Evidence', () => {
    const subject = withOwnEvidence(registerLocality(), (e) => ({
      ...e,
      sourceKey: 'wikimedia_commons_images',
    }));
    expect(validate(subject, options).aiTransfer.permitted).toBe(false);
  });
});
