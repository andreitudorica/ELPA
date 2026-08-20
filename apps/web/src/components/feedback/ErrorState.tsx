import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { env } from '@/lib/env';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Shown only in development builds — never leak internals to end users. */
  error?: unknown;
  onRetry?: () => void;
  minHeight?: number | string;
}

export function ErrorState({
  title,
  description,
  error,
  onRetry,
  minHeight = 240,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const devDetails = env.DEV && error instanceof Error ? error.message : undefined;

  return (
    <Stack
      role="alert"
      spacing={1.5}
      sx={{ alignItems: 'center', justifyContent: 'center', minHeight, px: 3, py: 4 }}
    >
      <Box sx={{ color: 'error.main', '& svg': { fontSize: 44 } }}>
        <ErrorOutlineIcon />
      </Box>
      <Typography variant="h6" component="p">
        {title ?? t('feedback.error.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }} align="center">
        {description ?? t('feedback.error.description')}
      </Typography>
      {devDetails !== undefined && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ maxWidth: 480, fontFamily: 'monospace' }}
          align="center"
        >
          {devDetails}
        </Typography>
      )}
      {onRetry !== undefined && (
        <Box sx={{ pt: 1 }}>
          <Button variant="outlined" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
