import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { routePaths } from '@/app/config/routes';
import { AppCard } from '@/components/common/AppCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/navigation/routerLinks';

export const Route = createFileRoute('/studio/_authenticated/')({
  component: StudioHome,
  staticData: {
    title: (t) => t('studio.documentTitle'),
  },
});

function StudioHome() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('studio.title')} description={t('studio.description')} />
      <AppCard title={t('researchCampaigns.title')} subheader={t('researchCampaigns.description')}>
        <ButtonLink to={routePaths.studioResearchCampaigns}>
          {t('researchCampaigns.open')}
        </ButtonLink>
      </AppCard>
    </>
  );
}
