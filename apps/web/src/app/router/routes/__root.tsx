import { type QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { appConfig } from '@/app/config/app';
import { RouteErrorFallback } from '@/app/router/RouteErrorFallback';
import '@/app/router/staticData';
import { allNamespaces } from '@/i18n';
import { env } from '@/lib/env';
import { NotFoundPage } from '@/pages/NotFoundPage';

export interface RouterContext {
  queryClient: QueryClient;
}

/** Applies the deepest matched route title to document.title, per language. */
function DocumentTitleSync() {
  const { t, i18n } = useTranslation(allNamespaces);
  const matches = useRouterState({ select: (state) => state.matches });

  useEffect(() => {
    const titles = matches
      .map((match) => match.staticData.title)
      .filter((title) => title !== undefined);
    const deepest = titles[titles.length - 1];
    document.title = appConfig.titleTemplate(deepest?.(t));
  }, [matches, t, i18n.language]);

  return null;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorFallback,
});

function RootComponent() {
  return (
    <>
      <DocumentTitleSync />
      <Outlet />
      {env.DEV && env.VITE_ENABLE_DEVTOOLS && <TanStackRouterDevtools position="bottom-left" />}
    </>
  );
}
