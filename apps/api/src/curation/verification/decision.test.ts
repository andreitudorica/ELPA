import { describe, expect, it } from 'vitest';

import type { Assessment, Strategy } from './contracts';
import { decide } from './decision';
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
import { followUp } from './follow-up';
import { validate } from './validator';

const options = { asOf: AS_OF, counties: COUNTIES };
const assessment = (
  verdict: Assessment['verdict'],
  status: Assessment['status'] = 'accepted',
): Assessment => ({
  status,
  verdict,
  errors: status === 'accepted' ? [] : ['invented_evidence_reference'],
  rationale: 'r',
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  concerns: [],
  model: 'test-model',
  promptVersion: 'p',
  costUsd: 0.001,
  latencyMs: 10,
});

function run(
  subject: ReturnType<typeof registerLocality>,
  strategy: Strategy,
  extra: Partial<Parameters<typeof decide>[0]> = {},
) {
  const validation = validate(subject, options);
  return decide({
    subject,
    validation,
    assessment: null,
    followUp: null,
    strategy,
    eligibility: null,
    ...extra,
  });
}

describe('decide', () => {
  it('recommends but never verifies without an approved eligibility', () => {
    const decision = run(registerLocality(), 'A');
    expect(decision.recommendation).toBe('auto_verify');
    expect(decision.outcome).toBe('not_eligible');
    expect(decision.reasons).toContain('category_gate_not_passed');
    expect(decision.eligibilityId).toBeNull();
  });

  it('verifies only at or above the calibrated threshold of an approved eligibility', () => {
    const eligibility = { id: uuid('eligibility'), threshold: 3 };
    const verified = run(registerLocality(), 'A', { eligibility });
    expect(verified.outcome).toBe('verified');
    expect(verified.eligibilityId).toBe(eligibility.id);
    const strict = run(registerLocality(), 'A', { eligibility: { ...eligibility, threshold: 5 } });
    expect(strict.outcome).toBe('not_eligible');
    expect(strict.reasons).toContain('below_calibrated_threshold');
  });

  it('never makes a high-consequence attribute autonomous, whatever the eligibility', () => {
    const subject = textFacility('parties_allowed', 'petreceri permise');
    const decision = run(subject, 'B', {
      assessment: assessment('supported'),
      eligibility: { id: uuid('e'), threshold: 0 },
    });
    expect(subject.category).toBe('high_consequence');
    expect(decision.outcome).toBe('not_eligible');
    expect(decision.reasons).toContain('category_never_autonomous');
  });

  it('requires an accepted semantic assessment for text facilities', () => {
    const subject = textFacility('sauna', 'saună');
    expect(run(subject, 'A').recommendation).toBe('further_research_required');
    expect(run(subject, 'C', { assessment: assessment('supported') }).recommendation).toBe(
      'auto_verify',
    );
    expect(
      run(subject, 'C', { assessment: assessment('supported', 'rejected') }).recommendation,
    ).toBe('further_research_required');
    expect(
      run(subject, 'C', { assessment: assessment('incorrect_entity_attribution') }).recommendation,
    ).toBe('contradicted');
  });

  it('lets an assessment block but not bypass deterministic validation', () => {
    const rejected = registerLocality({ countyCode: 'RO-ZZ' });
    expect(run(rejected, 'B', { assessment: assessment('supported') }).recommendation).toBe(
      'insufficient_evidence',
    );
    expect(
      run(registerLocality(), 'B', { assessment: assessment('uncertain') }).recommendation,
    ).toBe('further_research_required');
    // Strategy C skips the assessor for structured register facts.
    const skipped = run(registerLocality(), 'C', { assessment: assessment('contradicted') });
    expect(skipped.recommendation).toBe('auto_verify');
    expect(skipped.assessmentUsed).toBe(false);
  });

  it('marks superseded Claims not eligible and conflicting Claims contradicted', () => {
    expect(run(registerLocality({ claim: { methodCurrent: false } }), 'A').reasons).toContain(
      'claim_superseded',
    );
    const sibling = claim(
      'sibling',
      'register-candidate',
      'register-1',
      'offer.primary_locality',
      { countyCode: 'RO-BV', settlementName: 'Brașov' },
      { type: 'structured_field', fields: ['Localitate', 'Județ', 'Tip localitate'] },
    );
    expect(run(registerLocality({ siblings: [sibling] }), 'A').recommendation).toBe('contradicted');
  });

  it('uses bounded follow-up only in the selective strategy', () => {
    const registerEvidence = evidence('register-2', 'situr_accommodation_register', [
      ['Județ', 'BRASOV'],
    ]);
    const subject = osmCounty({
      tags: [['tags.addr:county', 'Județul Cluj']],
      extraEvidence: [registerEvidence],
      counterparts: [
        {
          suggestionId: uuid('s'),
          strength: 'likely',
          candidate: {
            id: uuid('register-other'),
            sourceKey: 'situr_accommodation_register',
            sourceRecordKey: 'record-register-2',
            displayName: 'Casa',
          },
          claims: [
            claim(
              'register-other',
              'register-other',
              'register-2',
              'offer.primary_locality',
              { countyCode: 'RO-BV', settlementName: 'Brașov' },
              { type: 'structured_field', fields: ['Județ'] },
            ),
          ],
        },
      ],
    });
    const validation = validate(subject, options);
    const research = followUp(subject, validation, COUNTIES);
    expect(research.termination).toBe('resolved');
    expect(research.networkCalls).toBe(0);
    const base = { subject, validation, assessment: null, followUp: research, eligibility: null };
    expect(decide({ ...base, strategy: 'A' }).recommendation).toBe('further_research_required');
    expect(decide({ ...base, strategy: 'C' }).recommendation).toBe('auto_verify');
  });
});
