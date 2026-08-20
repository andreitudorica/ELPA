import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, type ReactNode } from 'react';

import { createAppTheme } from '@/theme';

/** Fresh QueryClient per test: no retries, no background noise. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient ?? createTestQueryClient()}>
      <ThemeProvider theme={createAppTheme()} storageManager={null}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Standard render: MUI theme + TanStack Query, plus a userEvent instance. */
export function renderWithProviders(
  ui: ReactElement,
  options: { queryClient?: QueryClient } = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const result = render(
    <TestProviders {...(options.queryClient ? { queryClient: options.queryClient } : {})}>
      {ui}
    </TestProviders>,
  );
  return { ...result, user };
}

/**
 * Renders `ui` inside a minimal real router (memory history), for components
 * that use Link/useNavigate/useBlocker.
 */
export async function renderWithRouter(
  ui: ReactElement,
  options: { queryClient?: QueryClient } = {},
): Promise<RenderResult & { user: ReturnType<typeof userEvent.setup> }> {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  await router.load();

  const user = userEvent.setup();
  const result = render(
    <TestProviders {...(options.queryClient ? { queryClient: options.queryClient } : {})}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return { ...result, user };
}
