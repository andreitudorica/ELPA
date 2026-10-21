import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CandidateDetail } from '@/lib/apiClient';
import { renderWithRouter } from '@/test/testUtils';

import { CandidateDetailPage } from './CandidateDetailPage';

vi.mock('../acquisitionApi', () => ({
  useCandidate: () => ({ isPending: false, isError: false, data: detail }),
}));

const detail: CandidateDetail = {
  candidate: {
    id: 'synthetic-candidate',
    sourceKey: 'osm_geofabrik_romania',
    sourceRecordKey: 'node/synthetic',
    displayName: 'Synthetic accommodation',
    countyCode: null,
    settlementName: null,
    screeningClass: 'ambiguous',
    verificationStatus: 'unverified',
    suggestionCount: 0,
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    kind: 'offer',
    sourceRecordUrl: null,
    latestEvidenceId: 'synthetic-evidence',
    firstSeenRunId: 'run',
    lastSeenRunId: 'run',
  },
  claims: [
    {
      id: 'synthetic-claim',
      target: 'offer.pool',
      value: true,
      evidenceLocator: {},
      extractionMethod: 'synthetic-rules@1',
      confidence: 0,
      reviewStatus: 'proposed',
      observedAt: '2026-01-01T00:00:00Z',
      evidenceId: 'synthetic-evidence',
      acquisitionRunId: 'run',
      current: false,
      extraction: {
        quote: 'Piscina este închisă iarna',
        fieldPath: ['tags', 'description'],
        start: 0,
        end: 26,
        documentId: 'synthetic-document',
        sourceVersion: 'synthetic-version',
        explicitness: 'explicit_positive',
        ambiguity: 'none',
        scope: 'advertised_accommodation',
        temporal: { kind: 'seasonal', text: 'iarna' },
        ontologyVersion: 'synthetic-ontology@1',
        evaluationStatus: 'independent_review_pending',
        grounding: 'technically_validated',
        conflictingClaimIds: ['different-current-claim'],
      },
    },
  ],
  evidence: [
    {
      id: 'synthetic-evidence',
      sourceRecordKey: 'node/synthetic',
      sourceRecordUrl: null,
      contentSha256: 'synthetic-checksum',
      payload: { tags: { description: 'Piscina este închisă iarna' } },
      redactedFields: [],
      observedAt: '2026-01-01T00:00:00Z',
      datasetVersion: 'synthetic-version',
      artifactSha256: 'synthetic-artifact',
      latest: true,
    },
  ],
  runRecords: [],
  suggestions: [],
};

describe('experimental Claim inspection', () => {
  it('shows the source span, version, uncertainty, conflict and pending review even for historical Claims', async () => {
    await renderWithRouter(
      <CandidateDetailPage campaignId="synthetic-campaign" candidateId="synthetic-candidate" />,
    );
    expect(screen.getByText('Experimental attribute extraction')).toBeVisible();
    expect(screen.getByText(/semantic accuracy has not been independently reviewed/)).toBeVisible();
    expect(screen.getByText('Piscina este închisă iarna')).toBeVisible();
    expect(screen.getByText(/Historical method or Evidence/)).toBeVisible();
    expect(screen.getByText(/1 other current Claims/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /synthetic-version.*tags → description/ }),
    ).toHaveAttribute('href', '#evidence-synthetic-evidence');
    expect(screen.queryByRole('button', { name: /verify|publish/i })).not.toBeInTheDocument();
  });
});
