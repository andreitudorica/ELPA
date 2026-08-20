import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Pathless layout for the anonymous Recommendation Product surface (ADR 0015).
 * No authorization is applied here — the API enforces every request boundary
 * (ADR 0008/0009). This layout holds shared public chrome (locale bootstrap,
 * public navigation) as it grows; today it is a bare shell.
 */
export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});

function PublicLayout() {
  return <Outlet />;
}
