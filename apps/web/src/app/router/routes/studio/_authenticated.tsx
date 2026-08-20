import { Outlet, createFileRoute } from '@tanstack/react-router';

import { requireAdministrator } from '@/lib/identity';

/**
 * Pathless guard nested under `/studio`. Every guarded Data Studio surface
 * lives under `studio/_authenticated/*`. The `beforeLoad` policy delegates
 * to the identity boundary (ADR 0008/0009/0010): missing Administrator
 * identity redirects to `/studio/unauthorized`; other API failures escape
 * to the route error boundary.
 */
export const Route = createFileRoute('/studio/_authenticated')({
  beforeLoad: async ({ location, context }) => {
    await requireAdministrator({ location, queryClient: context.queryClient });
  },
  component: AuthenticatedStudioLayout,
});

function AuthenticatedStudioLayout() {
  return <Outlet />;
}
