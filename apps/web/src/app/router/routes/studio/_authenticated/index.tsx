import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute } from '@tanstack/react-router';

/** Data Studio home (placeholder — grown lazily as curation surfaces land). */
export const Route = createFileRoute('/studio/_authenticated/')({
  component: StudioHome,
  staticData: {
    title: () => 'Home · Data Studio',
  },
});

function StudioHome() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        Data Studio
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Administrator surfaces will grow here.
      </Typography>
    </Stack>
  );
}
