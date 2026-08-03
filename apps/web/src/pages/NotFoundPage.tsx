import SearchOffIcon from '@mui/icons-material/SearchOff';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ButtonLink } from '@/components/navigation/routerLinks';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <EmptyState
        icon={<SearchOffIcon />}
        title={t('feedback.notFound.title')}
        description={t('feedback.notFound.description')}
        action={
          <ButtonLink to="/dashboard" variant="contained">
            {t('feedback.notFound.action')}
          </ButtonLink>
        }
      />
    </Box>
  );
}
