import { sha256Hex } from '../acquisition/source-record';
import { propositionSchema, type Proposition, type ReconciliationCase } from './contracts';

export function uuid(n: number) {
  return `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
}
export function proposition(n = 1, change: Partial<Proposition> = {}): Proposition {
  return propositionSchema.parse({
    claimId: uuid(n),
    candidateId: uuid(100),
    evidenceId: uuid(n + 200),
    entityLevel: 'offer',
    scope: 'advertised_accommodation',
    attribute: 'pool',
    value: true,
    unit: null,
    qualifiers: {
      capacityBasis: 'unknown',
      access: 'private',
      months: null,
      approximate: false,
      ambiguous: false,
    },
    validity: { from: '2026-01-01T00:00:00.000Z', until: '2027-01-01T00:00:00.000Z' },
    observedAt: '2026-01-01T00:00:00.000Z',
    acquiredAt: '2026-02-01T00:00:00.000Z',
    sourcePublishedAt: null,
    extractedAt: '2026-03-01T00:00:00.000Z',
    method: 'fixture@1',
    methodStatus: 'current',
    explicitness: 'explicit',
    evidence: {
      sourceKey: 'osm_geofabrik_romania',
      sourceRecordKey: `synthetic-${String(n)}`,
      sourceVersion: 'fixture@1',
      contentSha256: sha256Hex(String(n)),
      originalId: `synthetic-${String(n)}`,
      passageFingerprint: null,
      quote: 'Synthetic evidence',
      locator: {},
      grounding: 'valid',
    },
    ...change,
  });
}
export function item(propositions: Proposition[]): ReconciliationCase {
  return {
    id: sha256Hex('case'),
    anchorCandidateId: uuid(100),
    group: sha256Hex('group'),
    partition: 'holdout',
    stratum: 'reprocessed',
    identity: 'candidate_scoped_unresolved_cross_candidate',
    identitySuggestionIds: [],
    candidateIds: [...new Set(propositions.map((p) => p.candidateId))],
    propositions,
    lineage: [],
  };
}
