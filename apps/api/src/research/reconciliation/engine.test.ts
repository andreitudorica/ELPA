import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import { compare, normalize, reconcile } from './engine';

import { proposition, item, uuid } from './fixtures';
const asOf = '2026-10-22T00:00:00.000Z';

describe('versioned reconciliation semantics', () => {
  it('compares normalized assertions without mutating inputs or depending on Claim order', () => {
    const a = proposition(),
      b = proposition(2);
    const input = item([a, b]);
    const before = canonicalJson(input);
    const result = reconcile(input, asOf);
    expect(result.pairs[0]?.relation).toBe('equivalent');
    expect(result.profiles[0]?.support).toBe('supported');
    expect(result.profiles[0]?.corroboration).toBe('none');
    expect(reconcile({ ...input, propositions: [b, a] }, asOf)).toEqual(result);
    expect(canonicalJson(input)).toBe(before);
    expect(result.status).toBe('research_only');
  });
  it('normalizes hectares but preserves the source measurement in the input', () => {
    const a = proposition(1, { attribute: 'yard_area_m2', value: 0.2, unit: 'ha' });
    const b = proposition(2, { attribute: 'yard_area_m2', value: 2000, unit: 'm2' });
    expect(normalize(a).value).toBe(2000);
    expect(compare(a, b, []).relation).toBe('equivalent');
    expect(a.value).toBe(0.2);
  });
  it('separates capacity definitions and entity scopes', () => {
    const a = proposition(1, {
      attribute: 'sleeps_persons',
      value: 16,
      unit: 'persons',
      qualifiers: { ...proposition().qualifiers, capacityBasis: 'official_classified' },
    });
    const b = proposition(2, {
      ...a,
      claimId: uuid(2),
      value: 20,
      qualifiers: { ...a.qualifiers, capacityBasis: 'advertised_overnight' },
    });
    expect(compare(a, b, []).rule).toBe('R3_different_qualifiers');
    expect(
      compare(a, proposition(3, { ...a, claimId: uuid(3), entityLevel: 'provider' }), []).relation,
    ).toBe('not_comparable');
    expect(
      compare(a, proposition(4, { ...a, claimId: uuid(4), attribute: 'max_daytime_guests' }), [])
        .relation,
    ).toBe('not_comparable');
  });
  it('detects a real contradiction with matching context and explicit overlapping intervals', () => {
    const result = reconcile(item([proposition(), proposition(2, { value: false })]), asOf);
    expect(result.pairs[0]?.relation).toBe('conflicting');
    expect(result.profiles[0]?.support).toBe('conflicted');
    expect(result.profiles[0]?.supportedValues).toEqual([]);
  });
  it('keeps non-overlapping policies compatible and historical status orthogonal', () => {
    const a = proposition(1, {
      attribute: 'parties_allowed',
      value: 'yes',
      validity: { from: '2020-01-01T00:00:00Z', until: '2021-01-01T00:00:00Z' },
    });
    const b = proposition(2, {
      attribute: 'parties_allowed',
      value: 'no',
      validity: { from: '2021-01-01T00:00:00Z', until: '2022-01-01T00:00:00Z' },
    });
    const result = reconcile(item([a, b]), asOf);
    expect(result.pairs[0]?.relation).toBe('compatible');
    expect(result.profiles[0]?.temporal).toBe('historical');
    expect(result.profiles[0]?.support).toBe('supported');
  });
  it('handles disjoint seasonal policies without inventing overlap', () => {
    const a = proposition(1, {
      attribute: 'parties_allowed',
      value: 'yes',
      qualifiers: { ...proposition().qualifiers, months: [6, 7, 8] },
    });
    const b = proposition(2, {
      attribute: 'parties_allowed',
      value: 'no',
      qualifiers: { ...proposition().qualifiers, months: [12, 1, 2] },
    });
    expect(compare(a, b, []).relation).toBe('compatible');
    expect(
      compare(
        a,
        proposition(3, { ...b, claimId: uuid(3), qualifiers: { ...b.qualifiers, months: null } }),
        [],
      ).relation,
    ).toBe('unresolved');
  });
  it('abstains when validity, critical qualifiers, approximations or grounding are unknown', () => {
    const a = proposition(1, { validity: { from: null, until: null } }),
      b = proposition(2, { value: false, validity: { from: null, until: null } });
    const result = reconcile(item([a, b]), asOf);
    expect(result.pairs[0]?.relation).toBe('unresolved');
    expect(result.profiles[0]?.freshness).toBe('uncertain');
    expect(result.profiles[0]?.support).toBe('insufficient_evidence');
    const capacity = proposition(3, { attribute: 'sleeps_persons', value: 20, unit: 'persons' });
    expect(reconcile(item([capacity]), asOf).profiles[0]?.support).toBe('insufficient_evidence');
    expect(
      compare(a, proposition(4, { evidence: { ...a.evidence, grounding: 'invalid' } }), []).rule,
    ).toBe('R2_invalid_ambiguous_or_inactive');
    expect(
      compare(a, proposition(5, { qualifiers: { ...a.qualifiers, approximate: true } }), [])
        .relation,
    ).toBe('unresolved');
  });
  it('does not count the same Evidence or syndicated passages as independent support', () => {
    const a = proposition(),
      b = proposition(2, { evidenceId: a.evidenceId });
    const input = item([a, b]);
    input.lineage = [
      {
        leftEvidenceId: a.evidenceId,
        rightEvidenceId: b.evidenceId,
        relation: 'independent',
        basis: 'Conflicting reviewer assertion',
        evidenceReferences: ['synthetic'],
      },
    ];
    expect(reconcile(input, asOf).profiles[0]?.corroboration).toBe('possible_correlation');
    const c = proposition(3, {
      evidence: {
        ...proposition(3).evidence,
        passageFingerprint: sha256Hex('long identical passage'),
      },
    });
    const d = proposition(4, {
      evidence: { ...proposition(4).evidence, passageFingerprint: c.evidence.passageFingerprint },
    });
    expect(compare(c, d, []).lineage).toBe('common_origin');
  });
  it('requires explicit independent provenance and keeps historical corroboration', () => {
    const a = proposition(1, {
      validity: { from: '2020-01-01T00:00:00Z', until: '2021-01-01T00:00:00Z' },
    });
    const b = proposition(2, { validity: a.validity });
    const input = item([a, b]);
    input.lineage = [
      {
        leftEvidenceId: a.evidenceId,
        rightEvidenceId: b.evidenceId,
        relation: 'independent',
        basis: 'Separate owner inspection and administrative record',
        evidenceReferences: ['synthetic-confirmation'],
      },
    ];
    expect(reconcile(input, asOf).profiles[0]).toMatchObject({
      support: 'supported',
      temporal: 'historical',
      corroboration: 'independent',
    });
  });
  it('keeps different Candidates conditional and never corroborates across an unreviewed identity link', () => {
    const result = reconcile(
      item([proposition(), proposition(2, { candidateId: uuid(101) })]),
      asOf,
    );
    expect(result.pairs[0]?.identityConditional).toBe(true);
    expect(result.profiles).toHaveLength(2);
    expect(
      result.profiles.every(
        (p) =>
          p.corroboration === 'none' &&
          p.uncertainties.includes('cross_candidate_identity_unreviewed'),
      ),
    ).toBe(true);
  });
  it('separates image visibility and shared facilities from Offer facts', () => {
    expect(
      compare(proposition(), proposition(2, { entityLevel: 'image', scope: 'image_visible' }), [])
        .relation,
    ).toBe('not_comparable');
    expect(compare(proposition(), proposition(2, { scope: 'shared_facility' }), []).relation).toBe(
      'not_comparable',
    );
  });
  it('preserves different nonexclusive recreation facilities', () => {
    expect(
      compare(
        proposition(1, { attribute: 'recreation', value: 'tennis' }),
        proposition(2, { attribute: 'recreation', value: 'table_tennis' }),
        [],
      ).relation,
    ).toBe('compatible');
  });
  it('rejects missing lineage and Candidate references', () => {
    const input = item([proposition()]);
    input.candidateIds = [uuid(999)];
    expect(() => reconcile(input, asOf)).toThrow('membership');
    const other = item([proposition()]);
    other.lineage = [
      {
        leftEvidenceId: uuid(901),
        rightEvidenceId: uuid(902),
        relation: 'independent',
        basis: 'fake',
        evidenceReferences: ['fake'],
      },
    ];
    expect(() => reconcile(other, asOf)).toThrow('Evidence reference');
  });
  it('changes the assessment digest after new evidence or validity while retaining the old result', () => {
    const input = item([proposition()]);
    const old = reconcile(input, asOf);
    const next = reconcile(
      { ...input, propositions: [...input.propositions, proposition(2, { value: false })] },
      asOf,
    );
    expect(next.inputDigest).not.toBe(old.inputDigest);
    expect(old.profiles[0]?.support).toBe('supported');
    expect(next.profiles[0]?.support).toBe('conflicted');
    expect(reconcile(input, '2027-10-22T00:00:00.000Z').inputDigest).not.toBe(old.inputDigest);
    const changedValidity = item([proposition(1, { validity: { from: null, until: null } })]);
    expect(reconcile(changedValidity, asOf).inputDigest).not.toBe(old.inputDigest);
    expect(reconcile(item([proposition(1, { method: 'fixture@2' })]), asOf).inputDigest).not.toBe(
      old.inputDigest,
    );
  });
});

it('normalizes season ordering and rejects capacity definitions inappropriate to an attribute', () => {
  const a = proposition(1, { qualifiers: { ...proposition().qualifiers, months: [8, 6, 7] } });
  const b = proposition(2, { qualifiers: { ...proposition().qualifiers, months: [6, 7, 8] } });
  expect(compare(a, b, []).relation).toBe('equivalent');
  expect(
    reconcile(
      item([
        proposition(3, {
          attribute: 'beds_count',
          value: 12,
          unit: 'beds',
          qualifiers: { ...a.qualifiers, capacityBasis: 'event_attendance' },
        }),
      ]),
      asOf,
    ).profiles[0]?.support,
  ).toBe('insufficient_evidence');
});
