/**
 * The single authentication boundary for `apps/web` (ADR 0008/0009/0010).
 *
 * Identity is server-owned; this module simply asks `/api/me` and caches
 * the answer in TanStack Query. No login UI ships in alpha — the API
 * decides whether the current session yields an Administrator. When OIDC
 * lands post-alpha, the login affordance lives inside `studio.tsx`
 * unauth chrome; the shape of the exports below does not change.
 *
 * This module must NOT be imported from `src/app/router/routes/_public/**`
 * — the anonymous Recommendation Product does not read identity. The
 * ESLint boundary in `eslint.config.js` enforces this at build time.
 */
export type { Administrator } from './types';
export { identityQueryKey, useCurrentAdministrator, ensureCurrentAdministrator } from './queries';
export { requireAdministrator } from './guards';
