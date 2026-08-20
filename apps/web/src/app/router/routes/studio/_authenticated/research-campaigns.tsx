import { createFileRoute } from '@tanstack/react-router';

import { ResearchCampaignsPage } from '@/features/research/ResearchCampaignsPage';

export const Route = createFileRoute('/studio/_authenticated/research-campaigns')({
  component: ResearchCampaignsPage,
  staticData: {
    title: (t) => t('researchCampaigns.documentTitle'),
    breadcrumb: (t) => t('researchCampaigns.title'),
  },
});
