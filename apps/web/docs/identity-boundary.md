# Identity boundary

The single authentication surface for `apps/web`. Realises ADR 0008
(anonymous Users and Administrator-only Data Studio), ADR 0009 (external
identity, internal authorization), and ADR 0010 (simulated identity restricted
to development and infrastructure-protected private alpha).

## Location

`src/lib/identity/` is the only module that knows how identity is resolved.
Its public API (`useCurrentAdministrator`, `ensureCurrentAdministrator`,
`requireAdministrator`) is consumed by the Data Studio route guard and the
Data Studio chrome. It must **not** be imported from
`src/app/router/routes/_public/**`; the ESLint boundary rule enforces this.

## How identity is resolved

`GET /api/me` is the single source of truth. The client caches the result in
TanStack Query (`identityQueryKey`), and the `_studio/_authenticated`
`beforeLoad` awaits `ensureCurrentAdministrator` before permitting entry.

- 401/403 → cached identity is `null`, guard redirects to `/studio/unauthorized`.
- 2xx → cached `Administrator`, studio subtree renders.
- 5xx / network error → propagates to the route error boundary.

Identity is never mirrored into a Zustand store (per AGENTS.md working rules).

## Alpha behavior

`apps/api` returns a simulated Administrator in local development and in the
infrastructure-protected private alpha environment (ADR 0010). The client
does not know this is a simulation — it observes only the response. `apps/api`
is the enforcer that refuses to start with simulation enabled in a public
production deployment; the client never carries a "simulate identity" flag.

## No login UI in alpha

There is no client-side login form. `/studio/login` does not exist. When OIDC
lands post-alpha, the sign-in affordance is added under the `/studio` unauth
chrome (`studio.tsx`); the shape of the identity module's exports does not
change, only the mechanism `apps/api` uses to resolve `/api/me`.

## Test posture

Component tests import from `@/lib/identity` and let MSW handlers return a
stubbed Administrator (see `src/mocks/handlers/identityHandlers.ts`). E2E
tests use the same mock backend by default; a live-API Playwright project
is added once `apps/api` is reachable.
