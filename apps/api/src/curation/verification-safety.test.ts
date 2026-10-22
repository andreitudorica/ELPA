import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { ADMIN_ROUTE_METADATA_KEY, ConflictError, PreconditionError } from '../common';
import { RecommendationModule } from '../recommendation';
import type { DecisionInsert } from './verification.repository';
import { VerificationController } from './verification.controller';
import { persistMachineDecisions, persistOverride } from './verification-persistence';
import { uuid } from './verification/fixtures.test-support';

function decision(overrides: Partial<DecisionInsert> = {}): DecisionInsert {
  return {
    researchCampaignId: uuid('campaign'),
    candidateId: uuid('candidate'),
    claimId: uuid('claim'),
    category: 'register_locality',
    method: 'machine_policy',
    outcome: 'not_eligible',
    recommendation: 'auto_verify',
    policyVersion: 'elpa-verification-policy@1',
    strategy: 'C',
    eligibilityId: null,
    supersedesDecisionId: null,
    evidenceIds: [uuid('evidence')],
    inputClaimIds: [uuid('claim')],
    basis: {},
    evidenceScore: 4,
    overrideReason: null,
    inputDigest: 'd'.repeat(64),
    asOf: new Date('2026-10-22T00:00:00Z'),
    decidedAt: new Date('2026-10-22T00:00:00Z'),
    decidedByAdministratorId: uuid('administrator'),
    ...overrides,
  };
}

function ports(eligibility: { id: string; category: string; revokedAt: Date | null }[] = []) {
  const events: string[] = [];
  return {
    events,
    ports: {
      transaction: async <T>(work: () => Promise<T>) => {
        events.push('begin');
        const result = await work();
        events.push('commit');
        return result;
      },
      insert: () => {
        events.push('insert');
        return Promise.resolve(uuid(`row-${String(events.length)}`));
      },
      eligibility: () =>
        Promise.resolve(
          eligibility.map((e) => ({ ...e, policyVersion: 'elpa-verification-policy@1' })),
        ),
      audit: () => {
        events.push('audit');
        return Promise.resolve();
      },
      superseded: () => Promise.resolve(false),
    },
  };
}

const input = (decisions: DecisionInsert[]) => ({
  campaignId: uuid('campaign'),
  administratorId: uuid('administrator'),
  corpusDigest: 'c'.repeat(64),
  decisions,
});

describe('publication and verification safety', () => {
  it('records gated recommendations with an audit event and no publication field', async () => {
    const { events, ports: p } = ports();
    await expect(persistMachineDecisions(input([decision()]), p)).resolves.toBe(1);
    expect(events).toEqual(['begin', 'insert', 'audit', 'commit']);
    expect(Object.keys(decision())).not.toContain('publication');
  });

  it('refuses machine verification without an active eligibility for the same category', async () => {
    const verified = decision({ outcome: 'verified', eligibilityId: uuid('eligibility') });
    for (const eligibility of [
      [],
      [{ id: uuid('eligibility'), category: 'register_locality', revokedAt: new Date() }],
      [{ id: uuid('eligibility'), category: 'osm_county', revokedAt: null }],
    ]) {
      const { events, ports: p } = ports(eligibility);
      await expect(persistMachineDecisions(input([verified]), p)).rejects.toBeInstanceOf(
        PreconditionError,
      );
      expect(events).not.toContain('insert');
    }
    const { ports: approved } = ports([
      { id: uuid('eligibility'), category: 'register_locality', revokedAt: null },
    ]);
    await expect(persistMachineDecisions(input([verified]), approved)).resolves.toBe(1);
  });

  it('never machine-verifies a high-consequence category, even with an eligibility id', async () => {
    const { ports: p } = ports([
      { id: uuid('eligibility'), category: 'high_consequence', revokedAt: null },
    ]);
    await expect(
      persistMachineDecisions(
        input([
          decision({
            category: 'high_consequence',
            outcome: 'verified',
            eligibilityId: uuid('eligibility'),
          }),
        ]),
        p,
      ),
    ).rejects.toBeInstanceOf(PreconditionError);
  });

  it('rejects batch writes that pose as Administrator decisions or rejections', async () => {
    const { ports: p } = ports();
    await expect(
      persistMachineDecisions(input([decision({ method: 'administrator' })]), p),
    ).rejects.toBeInstanceOf(PreconditionError);
    await expect(
      persistMachineDecisions(input([decision({ outcome: 'rejected' })]), p),
    ).rejects.toBeInstanceOf(PreconditionError);
  });

  it('accepts an override only as an audited Administrator decision with a reason', async () => {
    const previous = uuid('previous');
    const override = decision({
      method: 'administrator',
      outcome: 'rejected',
      recommendation: null,
      strategy: null,
      supersedesDecisionId: previous,
      overrideReason: 'Register row belongs to a different unit',
    });
    const { events, ports: p } = ports();
    const args = { decision: override, supersededId: previous, administratorId: uuid('a') };
    await expect(persistOverride(args, p)).resolves.toBeTypeOf('string');
    expect(events).toEqual(['begin', 'insert', 'audit', 'commit']);
    await expect(
      persistOverride({ ...args, decision: { ...override, overrideReason: 'short' } }, p),
    ).rejects.toBeInstanceOf(PreconditionError);
    await expect(
      persistOverride(args, { ...p, superseded: () => Promise.resolve(true) }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('serves verification only under the Administrator route boundary', () => {
    expect(Reflect.getMetadata(ADMIN_ROUTE_METADATA_KEY, VerificationController)).toBe(true);
    expect(Reflect.getMetadata('path', VerificationController)).toBe('admin/verification');
  });

  it('keeps the anonymous Recommendation module free of controllers and Research or Curation', () => {
    expect(Reflect.getMetadata('controllers', RecommendationModule) ?? []).toEqual([]);
    expect(Reflect.getMetadata('imports', RecommendationModule) ?? []).toEqual([]);
  });
});
