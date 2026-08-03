import { redirect, type ParsedLocation } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

import { routePaths } from '@/app/config/routes';

import { ensureCurrentAdministrator } from './queries';
import type { Administrator } from './types';

interface RequireAdministratorArgs {
  location: ParsedLocation;
  queryClient: QueryClient;
}

/**
 * TanStack Router `beforeLoad` helper for guarded Data Studio routes.
 * Redirects to `/studio/unauthorized` when no Administrator identity is
 * present. Any other API failure propagates so route-level error boundaries
 * see it. See ADR 0008/0009/0010.
 */
export async function requireAdministrator({
  queryClient,
}: RequireAdministratorArgs): Promise<Administrator> {
  const identity = await ensureCurrentAdministrator(queryClient);
  if (identity === null) {
    throw redirect({ to: routePaths.studioUnauthorized });
  }
  return identity;
}
