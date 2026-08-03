import { useQuery, type QueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import type { Administrator } from './types';

/**
 * Single query key for the current Administrator identity. All identity reads
 * flow through TanStack Query so the guard, the header chrome, and any
 * future studio surface observe the same cached value.
 */
export const identityQueryKey = ['identity', 'me'] as const;

async function fetchCurrentAdministrator(): Promise<Administrator | null> {
  try {
    return await api.get<Administrator>('/me');
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
      return null;
    }
    throw error;
  }
}

/** Suspense-friendly hook returning the current Administrator, or `null` when unauthenticated. */
export function useCurrentAdministrator() {
  return useQuery({
    queryKey: identityQueryKey,
    queryFn: fetchCurrentAdministrator,
    staleTime: 60_000,
  });
}

/** Route-guard helper: fetches identity through the shared cache. */
export async function ensureCurrentAdministrator(
  queryClient: QueryClient,
): Promise<Administrator | null> {
  return queryClient.fetchQuery({
    queryKey: identityQueryKey,
    queryFn: fetchCurrentAdministrator,
    staleTime: 60_000,
  });
}
