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
    // E2E escape hatch: tests can drop the stubbed identity by setting
    // `window.__ELPA_E2E_NO_IDENTITY__ = true` via Playwright's
    // `addInitScript` before navigating. Handlers run in the page context
    // (MSW broadcasts SW intercepts to the client), so `window` is reachable.
    // The flag is dev/test only and never ships to production.
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __ELPA_E2E_NO_IDENTITY__?: boolean }).__ELPA_E2E_NO_IDENTITY__ ===
        true
    ) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({
      id: 'admin-local',
      email: 'admin@elpa.local',
      displayName: 'Local Administrator',
    });
  }),
];
