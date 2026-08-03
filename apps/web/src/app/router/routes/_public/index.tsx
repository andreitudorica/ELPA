import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/app/config/app';

/** Recommendation Product landing (placeholder — grown lazily). */
export const Route = createFileRoute('/_public/')({
  component: PublicLanding,
  staticData: {
    title: () => appConfig.name,
  },
});

function PublicLanding() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4 }}>
      <Stack spacing={2} sx={{ textAlign: 'center' }}>
        <Typography variant="h3" component="h1">
          {appConfig.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Recommendation Product placeholder.
        </Typography>
      </Stack>
    </Box>
  );
}
