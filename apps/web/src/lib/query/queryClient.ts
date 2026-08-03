import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { normalizeError, type ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
    queryMeta: {
      /** Snackbar message shown when this query fails. Omit to fail silently (UI handles it). */
      errorMessage?: string;
    };
    mutationMeta: {
      /** Snackbar message shown when this mutation fails. */
      errorMessage?: string;
      /** Snackbar message shown when this mutation succeeds. */
      successMessage?: string;
    };
  }
}

export interface QueryClientCallbacks {
  notifyError: (message: string) => void;
  notifySuccess: (message: string) => void;
}

/**
 * Application QueryClient factory.
 *
 * - `staleTime` 30s: freshly fetched data is served from cache without refetching,
 *   which keeps route transitions instant while background refetching stays on.
 * - `retry`: only transient failures (network/timeout/5xx) are retried, once.
 * - Global error handling: queries/mutations opt into snackbar notifications
 *   via `meta.errorMessage` / `meta.successMessage`; everything is logged.
 */
export function createQueryClient(callbacks?: Partial<QueryClientCallbacks>): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < 1 && normalizeError(error).isRetryable,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.error('Query failed', error, { queryKey: query.queryKey });
        const message = query.meta?.errorMessage;
        if (message !== undefined) {
          callbacks?.notifyError?.(message);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logger.error('Mutation failed', error, { mutationKey: mutation.options.mutationKey });
        const message = mutation.meta?.errorMessage;
        if (message !== undefined) {
          callbacks?.notifyError?.(message);
        }
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message !== undefined) {
          callbacks?.notifySuccess?.(message);
        }
      },
    }),
  });
}
