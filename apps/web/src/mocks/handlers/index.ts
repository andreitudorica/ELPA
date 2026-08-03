import type { RequestHandler } from 'msw';

import { identityHandlers } from './identityHandlers';

/**
 * MSW handlers, grouped by feature. See ADR 0016 for the policy on how
 * handlers must be typed against the generated OpenAPI client once the
 * `apps/api` contract exists.
 */
export const handlers: RequestHandler[] = [...identityHandlers];
