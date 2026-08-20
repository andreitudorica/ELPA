# `mocks/`

Mock Service Worker (MSW) implementation of the backend, per ADR 0016.

## Scope

MSW runs only in **development**, **tests**, and **Storybook**. It never
executes in a production build. `main.tsx` gates the worker on both
`env.VITE_ENABLE_MOCKS` and `env.VITE_APP_ENV !== 'production'`. An
ESLint rule (`eslint.config.js`) forbids importing from `msw` outside
`src/mocks/**` and `src/test/**` so mock code cannot leak into
production bundles.

## Layout

```
mocks/
  browser.ts        # worker for the dev server / Storybook
  server.ts         # node server for Vitest
  utils.ts          # shared helpers (apiPath, networkDelay)
  handlers/
    index.ts        # aggregates all feature handlers
    identityHandlers.ts   # /api/me stub Administrator (ADR 0008/0009/0010)
```

## Typing rule

Handler request and response shapes must be typed against the generated
OpenAPI types in `../lib/apiClient/generated/**` once they exist, so a
contract change breaks the mocks at compile time. Hand-written interim
types under `types.ts` are permitted only until the first real
generation. Do not treat handlers as an alternative contract.

## Adding a handler

1. Add the feature file: `mocks/handlers/<feature>Handlers.ts`.
2. Import request/response types from `@/lib/apiClient/generated/schema` once
   the schema exists.
3. Register the array in `handlers/index.ts`.
