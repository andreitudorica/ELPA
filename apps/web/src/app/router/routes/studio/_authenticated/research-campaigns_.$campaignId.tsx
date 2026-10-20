import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { AcquisitionPage } from '@/features/research/acquisition/AcquisitionPage';
import {
  acquisitionSearchSchema,
  type AcquisitionSearchUpdate,
} from '@/features/research/acquisition/searchParams';

export const Route = createFileRoute('/studio/_authenticated/research-campaigns_/$campaignId')({
  validateSearch: (search) => acquisitionSearchSchema.parse(search),
  component: AcquisitionRoute,
  staticData: {
    title: (t) => t('acquisition.documentTitle'),
    breadcrumb: (t) => t('acquisition.title'),
  },
});

function AcquisitionRoute() {
  const { campaignId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onSearchChange = useCallback(
    (update: AcquisitionSearchUpdate) => {
      void navigate({ search: (previous) => ({ ...previous, ...update }), replace: true });
    },
    [navigate],
  );

  return (
    <AcquisitionPage campaignId={campaignId} search={search} onSearchChange={onSearchChange} />
  );
}
