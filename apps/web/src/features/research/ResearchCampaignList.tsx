import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { AppCard } from '@/components/common/AppCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { formatDateTime } from '@/utils/format';

import { useResearchCampaigns } from './api';

export function ResearchCampaignList() {
  const { t } = useTranslation();
  const campaigns = useResearchCampaigns(t('researchCampaigns.feedback.loadError'));

  if (campaigns.isPending) {
    return <LoadingState label={t('researchCampaigns.list.loading')} />;
  }
  if (campaigns.isError) {
    return (
      <ErrorState
        error={campaigns.error}
        description={t('researchCampaigns.feedback.loadError')}
        onRetry={() => void campaigns.refetch()}
      />
    );
  }
  if (campaigns.data.length === 0) {
    return (
      <EmptyState
        title={t('researchCampaigns.list.emptyTitle')}
        description={t('researchCampaigns.list.emptyDescription')}
      />
    );
  }

  return (
    <Stack spacing={2}>
      {campaigns.data.map((campaign) => (
        <AppCard
          key={campaign.id}
          title={campaign.name}
          subheader={t('researchCampaigns.list.created', {
            date: formatDateTime(campaign.createdAt),
            administrator: campaign.createdBy.displayName,
          })}
        >
          <Stack spacing={2}>
            <Typography>{campaign.eventNeed}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('researchCampaigns.list.location', {
                county: campaign.county,
                locality: campaign.locality ?? t('researchCampaigns.list.allLocalities'),
              })}
            </Typography>
            <List dense disablePadding>
              {campaign.minimumCriteria.map((criterion) => (
                <ListItem key={criterion} disableGutters>
                  <ListItemText primary={criterion} />
                </ListItem>
              ))}
            </List>
            <Stack spacing={0.5}>
              <Typography variant="overline">{t('researchCampaigns.list.sources')}</Typography>
              {campaign.investigatedSources.map((source) => (
                <Link
                  key={source}
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {source}
                </Link>
              ))}
            </Stack>
          </Stack>
        </AppCard>
      ))}
    </Stack>
  );
}
