import { http, HttpResponse } from 'msw';

import type { components } from '@/lib/apiClient/generated/schema';

import { apiPath, networkDelay } from '../utils';

/**
 * MSW handler for the identity boundary (ADR 0008/0009/0010).
 *
 * In local development the mock backend returns a stubbed Administrator so
 * Data Studio routes are reachable end-to-end without `apps/api`. Once the
 * OpenAPI contract exists, this handler must type its response off the
 * generated `Administrator` schema so contract drift is a TypeScript error
 * (ADR 0016).
 */
export const identityHandlers = [
  http.get(apiPath('/me'), async () => {
    await networkDelay();
    const administrator: components['schemas']['Administrator_Output'] = {
      id: '0198c5d2-8b7a-7000-8000-000000000001',
      email: 'admin@elpa.local',
      displayName: 'Local Administrator',
    };
    return HttpResponse.json(administrator);
  }),
];
