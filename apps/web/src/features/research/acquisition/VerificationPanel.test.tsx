import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import type { VerificationDecision, VerificationPolicy } from '@/lib/apiClient';
import { renderWithRouter } from '@/test/testUtils';

import { VerificationDetails } from './VerificationPanel';

const policy: VerificationPolicy = {
  version: 'elpa-verification-policy@1',
  categories: [
    {
      id: 'register_locality',
      risk: 'lower',
      proposition: 'County and locality',
      intendedUse: 'Filtering',
      evidenceRequirements: ['Explicit register fields'],
      autonomy: 'gated',
      corroboration: 'not_required',
      assessor: 'not_required',
      publicationMethods: ['machine_policy', 'administrator'],
      freshnessDays: 365,
      gate: {
        minAccepted: 100,
        maxFalseApprovalPoint: 0.02,
        maxFalseApprovalUpper: 0.05,
        minAgreement: 0.9,
        minReviewers: 2,
      },
      eligibility: null,
    },
  ],
  evaluation: null,
};

const decision: VerificationDecision = {
  id: 'decision',
  claimId: 'claim',
  target: 'offer.primary_locality',
  claimValue: { countyCode: 'RO-CJ', settlementName: 'Cluj-Napoca' },
  claimSuperseded: false,
  category: 'register_locality',
  risk: 'lower',
  method: 'machine_policy',
  outcome: 'not_eligible',
  recommendation: 'auto_verify',
  policyVersion: 'elpa-verification-policy@1',
  strategy: 'C',
  evidenceScore: 3,
  reasons: ['category_gate_not_passed'],
  conditions: ['single_record'],
  proposition: {
    attribute: 'county_and_locality',
    value: { countyCode: 'RO-CJ', settlementName: 'Cluj-Napoca' },
  },
  validation: null,
  assessment: null,
  followUp: null,
  eligibilityId: null,
  overrideReason: null,
  supersedesDecisionId: null,
  supersededBy: null,
  decidedAt: '2026-10-22T00:00:00Z',
  asOf: '2026-10-22T00:00:00Z',
  publication: {
    status: 'blocked',
    reasons: [
      'separate_publication_decision_required',
      'register_reuse_terms_pending_legal_review',
    ],
  },
};

it('shows a gated machine recommendation as not verified, with publication blocked', async () => {
  await renderWithRouter(
    <VerificationDetails
      decisions={[decision]}
      policy={policy}
      campaignId="campaign"
      candidateId="candidate"
    />,
  );
  expect(screen.getByText('Machine policy')).toBeInTheDocument();
  expect(screen.queryByText('Administrator')).not.toBeInTheDocument();
  expect(screen.getByText('Not eligible for automatic verification')).toBeInTheDocument();
  expect(screen.getByText(/Recommended for automatic verification/)).toBeInTheDocument();
  expect(
    screen.getByText(/Publication blocked: separate_publication_decision_required/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Gate closed: not_evaluated/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
});

it('requires an auditable reason before recording an Administrator correction', async () => {
  const user = userEvent.setup();
  await renderWithRouter(
    <VerificationDetails
      decisions={[decision]}
      policy={policy}
      campaignId="campaign"
      candidateId="candidate"
    />,
  );
  await user.type(screen.getByLabelText(/Reason \(audited\)/), 'too short');
  await user.click(screen.getByRole('button', { name: 'Record correction' }));
  expect(await screen.findByText('The reason needs at least 10 characters')).toBeInTheDocument();
});

it('marks superseded decisions and hides their correction form', async () => {
  await renderWithRouter(
    <VerificationDetails
      decisions={[{ ...decision, supersededBy: 'later' }]}
      policy={policy}
      campaignId="campaign"
      candidateId="candidate"
    />,
  );
  expect(screen.getByText('Superseded by a later decision')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record correction' })).not.toBeInTheDocument();
});
