import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTranslation } from 'react-i18next';

import { routePaths } from '@/app/config/routes';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppLink } from '@/components/navigation/routerLinks';

import { useResearchCampaigns } from '../api';

import { CandidatesPanel } from './CandidatesPanel';
import { ReportPanel } from './ReportPanel';
import { RunsPanel } from './RunsPanel';
import {
  type AcquisitionSearch,
  type AcquisitionSearchUpdate,
  acquisitionTabs,
} from './searchParams';
import { SuggestionsPanel } from './SuggestionsPanel';

export interface AcquisitionPageProps {
  campaignId: string;
  search: AcquisitionSearch;
  onSearchChange: (update: AcquisitionSearchUpdate) => void;
}

/** Inspection surface for the acquisition baseline experiment of one Research Campaign. */
export function AcquisitionPage({ campaignId, search, onSearchChange }: AcquisitionPageProps) {
  const { t } = useTranslation();
  const campaigns = useResearchCampaigns(t('researchCampaigns.feedback.loadError'));
  const campaign = campaigns.data?.find((item) => item.id === campaignId);
  const tab = search.tab ?? 'runs';

  return (
    <>
      <PageHeader
        title={campaign?.name ?? t('acquisition.title')}
        description={t('acquisition.description')}
        breadcrumbs={
          <AppLink to={routePaths.studioResearchCampaigns} variant="body2">
            {t('researchCampaigns.title')}
          </AppLink>
        }
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('acquisition.unverifiedNotice')}
      </Alert>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_event, next: NonNullable<AcquisitionSearch['tab']>) => {
            onSearchChange({ tab: next });
          }}
          variant="scrollable"
          aria-label={t('acquisition.tabsLabel')}
        >
          {acquisitionTabs.map((value) => (
            <Tab key={value} value={value} label={t(`acquisition.tabs.${value}`)} />
          ))}
        </Tabs>
      </Box>
      {tab === 'runs' && <RunsPanel campaignId={campaignId} />}
      {tab === 'report' && <ReportPanel campaignId={campaignId} />}
      {tab === 'candidates' && (
        <CandidatesPanel campaignId={campaignId} search={search} onSearchChange={onSearchChange} />
      )}
      {tab === 'suggestions' && (
        <SuggestionsPanel campaignId={campaignId} search={search} onSearchChange={onSearchChange} />
      )}
    </>
  );
}
