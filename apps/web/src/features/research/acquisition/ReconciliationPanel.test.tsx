import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import type { ReconciliationList } from '@/lib/apiClient';
import { renderWithRouter } from '@/test/testUtils';

import { ReconciliationHistory } from './ReconciliationPanel';

it('makes evidence, identity uncertainty and the applied rule inspectable without verification controls', async () => {
  const history: ReconciliationList = [
    {
      id: 'assessment',
      assessedAt: '2026-10-22T00:00:00Z',
      input: {
        id: 'case',
        anchorCandidateId: 'candidate',
        group: 'group',
        partition: 'development',
        stratum: 'cross_candidate',
        candidateIds: ['candidate', 'other'],
        identity: 'candidate_scoped_unresolved_cross_candidate',
        identitySuggestionIds: [],
        lineage: [],
        propositions: [
          {
            claimId: 'claim',
            candidateId: 'candidate',
            evidenceId: 'evidence',
            entityLevel: 'offer',
            scope: 'advertised_accommodation',
            attribute: 'pool',
            value: true,
            unit: null,
            qualifiers: {
              capacityBasis: 'unknown',
              access: 'unknown',
              months: null,
              approximate: false,
              ambiguous: false,
            },
            validity: { from: null, until: null },
            observedAt: '2026-01-01T00:00:00Z',
            acquiredAt: '2026-02-01T00:00:00Z',
            sourcePublishedAt: null,
            extractedAt: '2026-03-01T00:00:00Z',
            method: 'fixture@1',
            methodStatus: 'current',
            explicitness: 'explicit',
            evidence: {
              sourceKey: 'osm_geofabrik_romania',
              sourceRecordKey: 'synthetic',
              sourceVersion: 'fixture@1',
              contentSha256: 'hash',
              originalId: 'original',
              passageFingerprint: null,
              quote: 'Synthetic pool passage',
              locator: {},
              grounding: 'valid',
            },
          },
        ],
      },
      result: {
        ruleVersion: 'fixture@1',
        asOf: '2026-10-22T00:00:00Z',
        inputDigest: 'digest',
        caseId: 'case',
        status: 'research_only',
        evaluationStatus: 'independent_review_pending',
        profiles: [
          {
            candidateId: 'candidate',
            attribute: 'pool',
            claimIds: ['claim'],
            support: 'supported',
            corroboration: 'none',
            temporal: 'unknown',
            freshness: 'uncertain',
            supportedValues: [true],
            uncertainties: ['validity_unknown'],
          },
        ],
        pairs: [
          {
            leftClaimId: 'claim',
            rightClaimId: 'other-claim',
            attribute: 'pool',
            relation: 'unresolved',
            rule: 'R12_validity_overlap_unknown',
            lineage: 'unknown',
            identityConditional: true,
            warnings: ['independence_unknown'],
          },
        ],
      },
    },
  ];
  await renderWithRouter(<ReconciliationHistory history={history} campaignId="campaign" />);
  expect(
    screen.getByText(/Source assertions and identity links are unverified/),
  ).toBeInTheDocument();
  expect(screen.getByText('Synthetic pool passage')).toBeInTheDocument();
  expect(screen.getByText(/overlapping validity has not been established/)).toBeInTheDocument();
  expect(
    screen.getByText(/Candidates have not been independently established/),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Evidence evidence/ })).toHaveAttribute(
    'href',
    expect.stringContaining('#evidence-evidence'),
  );
  expect(screen.queryByRole('button', { name: /verify|publish/i })).not.toBeInTheDocument();
});
