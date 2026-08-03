# `apps/web` architecture

Concise reference for the decisions that shape this codebase. The README covers
day-to-day usage; this document covers _why_ things are structured the way they are.
Every entry references the ADR it derives from.

## Route families (ADR 0015)

`apps/web` hosts two audiences in one client, separated by route family and
two `beforeLoad` policies:

```
src/app/router/routes/
  __root.tsx                          # providers, i18n bootstrap, theme
  _public.tsx                         # pathless layout: anonymous chrome
  _public/
    index.tsx                         # / (Recommendation Product landing)
  studio.tsx                          # /studio unauth chrome
  studio/
    unauthorized.tsx                  # /studio/unauthorized (identity-less)
    _authenticated.tsx                # pathless guard: requireAdministrator
    _authenticated/
      index.tsx                       # /studio/ (Data Studio home)
```

The `_public` family is anonymous (Recommendation Product); the
`/studio/_authenticated` subtree is Administrator-only. The client separation
is UX, not authorization — the API enforces every request boundary.

An ESLint `no-restricted-imports` boundary (see `eslint.config.js`) prevents
`_public/**` from importing `studio/**`, the identity boundary, or admin API
namespaces, and prevents the reverse.

## Identity boundary (ADR 0008/0009/0010)

Identity is server-owned and read through `src/lib/identity/`. See
[docs/identity-boundary.md](./identity-boundary.md).

## API contract (ADR 0012)

The generated TypeScript client from `apps/api`'s OpenAPI document lives in
`src/lib/apiClient/generated/**` — never hand-edited. Curated re-exports in
`src/lib/apiClient/index.ts` are the sole public surface. The client
delegates transport to `src/lib/api/client.ts` (the single fetch chokepoint,
carrying token/401/timeout/Zod hooks). `apps/web` never imports from
`apps/api`.

## Mock backend (ADR 0016)

`src/mocks/` runs MSW in dev, tests, and Storybook only. See
[src/mocks/README.md](../src/mocks/README.md). Handlers must be typed off
`src/lib/apiClient/generated/**` once it exists; MSW imports are ESLint-
restricted to `src/mocks/**` and `src/test/**`.

## State ownership

Every piece of state has exactly one owner. Do not mirror state across systems.

| State                | Owner                              | Examples                                             |
| -------------------- | ---------------------------------- | ---------------------------------------------------- |
| Server data          | TanStack Query                     | identity (`/api/me`), all API-backed reads           |
| URL and search state | TanStack Router                    | route params, filters expressed in the URL           |
| Form state           | React Hook Form + Zod              | in-progress user input                               |
| Global client state  | Zustand slices in `src/app/store/` | theme mode, language, UI toggles (sidebar collapsed) |
| Ephemeral UI state   | `useState` / `useReducer`          | menus, modals, hover                                 |

Never mirror server state into Zustand. Persisted Zustand slices go through
`src/lib/storage`'s `createSafePersistStorage` to survive Safari private
mode and quota errors.

## Feature-based layout (target, empty at time of writing)

Domain modules will live in `src/features/<feature>/` when they land. Each
feature owns its API calls, schemas, hooks, components, and route
components, and exposes a curated public surface via its `index.ts`. Rules:

- **Import features only through their public API** (`@/features/…`).
- Domain features may sparingly depend on other features' public APIs.
- Shared code that is _not_ domain-specific lives in `src/components`,
  `src/hooks`, `src/lib`, `src/utils`, or `src/theme`.

`src/features/` is empty today (per AGENTS.md working rules — do not
scaffold features preemptively). It grows lazily as work lands.

## Layering

```
app (config, providers, router, store)
  ↓ imports
features (empty; will hold domain modules)
  ↓ imports
components / hooks / layouts / lib / theme / utils / i18n
```

`lib/` must never import from `features/`. Cross-cutting integration is
registered (e.g. `setAuthTokenProvider` on the transport, `setLoggerTransport`).

## Component workshop (ADR 0017)

Storybook 10 with `addon-a11y`, `addon-docs`, and `msw-storybook-addon` is
the component workshop. Stories are scoped to components, layouts, and
theme — no route trees, guards, identity, or feature modules. The
`src/**/*.stories.tsx` ESLint override enforces this.

## Quality gates (ADR 0017)

- Vitest 4 + Testing Library + jsdom for unit and component tests.
- Playwright + `@axe-core/playwright` for end-to-end and accessibility
  smoke tests. Chromium runs per PR; the full browser matrix runs nightly.
- ESLint 10 (flat, type-aware) with Prettier, Husky, `lint-staged`, and
  Commitlint. Root-level tools live at the monorepo root; app-specific
  configuration (Vite, Playwright, Storybook, ESLint) stays in `apps/web/`.

## i18n

- User-facing strings are Romanian by default (`VITE_DEFAULT_LOCALE=ro`),
  with English preserved as a translator-skeleton locale (per
  `AGENTS.md`).
- Namespaces: `common`, `validation` today. Feature namespaces are added
  as features land.
- Language preference persists client-side (`src/app/store/preferencesStore.ts`).

## Environment configuration

- All variables validated by a Zod schema in `src/lib/env/index.ts` and
  parsed once at startup.
- `VITE_APP_ENV` is the semantic deploy tier
  (`development` / `test` / `alpha` / `production`); it gates MSW and
  distinguishes protected-alpha from public-production behavior.
- No identity variables. Identity is server-side; adding a client
  identity flag would violate ADR 0010.
