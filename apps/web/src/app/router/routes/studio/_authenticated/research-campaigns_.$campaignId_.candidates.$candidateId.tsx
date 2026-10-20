import { createFileRoute } from '@tanstack/react-router';

import { CandidateDetailPage } from '@/features/research/acquisition/CandidateDetailPage';

export const Route = createFileRoute(
  '/studio/_authenticated/research-campaigns_/$campaignId_/candidates/$candidateId',
)({
  component: CandidateRoute,
  staticData: {
    title: (t) => t('acquisition.candidate.documentTitle'),
    breadcrumb: (t) => t('acquisition.candidate.title'),
  },
});

function CandidateRoute() {
  const { campaignId, candidateId } = Route.useParams();
  return <CandidateDetailPage campaignId={campaignId} candidateId={candidateId} />;
}
