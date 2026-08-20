import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/PageHeader';

import { ResearchCampaignForm } from './ResearchCampaignForm';
import { ResearchCampaignList } from './ResearchCampaignList';

export function ResearchCampaignsPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('researchCampaigns.title')}
        description={t('researchCampaigns.description')}
      />
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '400px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <ResearchCampaignForm />
        <ResearchCampaignList />
      </Box>
    </>
  );
}
