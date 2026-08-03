import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/app/providers/queryClient';
import { LoadingState } from '@/components/feedback/LoadingState';

import { RouteErrorFallback } from './RouteErrorFallback';
import { routeTree } from './routeTree.gen';
import './staticData';

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Preload route code + loader data when the user shows intent (hover/focus).
  defaultPreload: 'intent',
  // Let TanStack Query own data freshness; the router always re-runs loaders,
  // which resolve instantly from the query cache when data is fresh.
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: LoadingState,
  defaultErrorComponent: RouteErrorFallback,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
