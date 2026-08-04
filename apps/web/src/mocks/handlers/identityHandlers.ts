import { http, HttpResponse } from 'msw';

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
    return HttpResponse.json({
      id: 'admin-local',
      email: 'admin@elpa.local',
      displayName: 'Local Administrator',
    });
  }),
];
