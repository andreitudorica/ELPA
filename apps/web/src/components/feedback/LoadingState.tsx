import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

export interface LoadingStateProps {
  label?: string;
  minHeight?: number | string;
}

export function LoadingState({ label, minHeight = 240 }: LoadingStateProps) {
  const { t } = useTranslation();
  const text = label ?? t('feedback.loading');

  return (
    <Stack
      spacing={2}
      sx={{ alignItems: 'center', justifyContent: 'center', minHeight, px: 3, py: 4 }}
    >
      <CircularProgress aria-label={text} size={32} />
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}
