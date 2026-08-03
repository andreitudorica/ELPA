import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/app/config/app';

/**
 * `/studio` unauth chrome. Hosts pages that Administrators can reach without
 * an authenticated identity (currently only `/studio/unauthorized`; a real
 * `/studio/login` is deferred until OIDC replaces the alpha simulated-identity
 * boundary per ADR 0009/0010). Guarded studio surfaces live under the
 * pathless `studio/_authenticated` sibling.
 */
export const Route = createFileRoute('/studio')({
  component: StudioChrome,
  staticData: {
    title: () => `Data Studio · ${appConfig.name}`,
  },
});

function StudioChrome() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box component="header" sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>
            {appConfig.name} · Data Studio
          </Typography>
        </Stack>
      </Box>
      <Box component="main" id="main-content" tabIndex={-1} sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
