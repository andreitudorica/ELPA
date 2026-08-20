import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Shown when a request to enter Data Studio has no Administrator identity.
 * During the alpha (ADR 0010) there is no sign-in action — the environment
 * either provides an Administrator identity or it does not. A real
 * "Sign in" affordance lands with OIDC (ADR 0009).
 */
export const Route = createFileRoute('/studio/unauthorized')({
  component: StudioUnauthorized,
  staticData: {
    title: () => 'Unauthorized · Data Studio',
  },
});

function StudioUnauthorized() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Typography variant="h5" component="h1">
        Unauthorized
      </Typography>
      <Alert severity="warning">
        No Administrator identity is present in this session. Data Studio is not accessible.
      </Alert>
      <Typography variant="body2" color="text.secondary">
        Verify that the environment provides an Administrator identity, or contact the operator of
        this deployment.
      </Typography>
    </Stack>
  );
}
