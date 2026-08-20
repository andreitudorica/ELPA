# API contract stack: Zod-first validation, OpenAPI, generated client

`apps/api` uses **Zod as the single source of truth** for every DTO,
request/response schema, and Layer-2 attribute definition. Nest
integration is via `nestjs-zod` (`createZodDto`, global
`ZodValidationPipe`, `patchNestJsSwagger`). The API produces a
**committed `apps/api/openapi.yaml`** from a headless build step;
`apps/web` consumes it via **`openapi-typescript`** (types) +
**`openapi-fetch`** (a ~1 kB typed fetch wrapper). TanStack Query hooks
are hand-written on top of the typed client. Errors use **RFC 7807
`application/problem+json`** with a required `correlation_id`, mapped by
a single `AppExceptionFilter` from a typed `AppError` hierarchy.

## Why

- **Zod-first prevents two validation systems** for the same data.
  Layer-2 JSONB per ADR 0021 already validates with Zod; using
  class-validator at the HTTP boundary would duplicate schemas and
  invite drift. One schema, two consumers (Nest pipe + swagger
  emission).
- **Committed OpenAPI + drift-check in CI** means the client cannot
  silently diverge from the server. A PR that changes a controller
  without regenerating fails `pnpm validate`.
- **Chose `openapi-typescript` + `openapi-fetch`** over full-runtime
  generators (`hey-api/openapi-ts`, `orval`, older
  `openapi-typescript-codegen`) because those couple us to a specific
  fetch/query flavor and ship 15–40 kB of generated runtime. `openapi-fetch`
  is ~1 kB and framework-agnostic; hand-written TanStack Query hooks
  are three lines each and give us explicit control over cache keys,
  error handling, and naming.
- **Typed `AppError` hierarchy + single exception filter** removes
  controller-level `try/catch` entirely. The exhaustive switch on error
  subtype uses `assertNever`, so adding a new error subtype without
  adding a filter case is a TypeScript compile error. Impossible to ship
  an unmapped error type — the "fix from core" property.
- **RFC 7807 problem+json** is understood by common HTTP tooling
  (browsers, SDKs, log platforms). Correlation ID in the body + response
  header lets a User quote either when reporting a failure.

## Consequences

- Adding an endpoint is: (a) declare Zod schemas in
  `<module>/dto/`, (b) write the controller referencing them via
  `createZodDto`, (c) throw typed `AppError` subtypes from services.
  Nothing else — validation, OpenAPI, client types, and error mapping
  all follow.
- Adding a new response projection (canonical vs published, per
  ADR 0012) is a new Zod schema file with `.pick()` / transforms —
  never a role-conditional shape on one schema. Both appear as distinct
  `components.schemas` in OpenAPI.
- `openapi.yaml` and the generated `apps/web/src/lib/apiClient/schema.ts`
  are committed. Reviewers see the contract diff in the PR; codegen
  drift is caught by CI's `git diff --exit-code` step.
- No API versioning (no `/v1/*`) until a genuine v2 exists. Adding it
  later is trivial and cheap; adding it prematurely is ceremony that
  outlives its usefulness.
- The `nestjs-zod`, `openapi-typescript`, and `openapi-fetch` packages
  are small, actively maintained, and each has a clear replaceable
  alternative if it ever became abandoned. The commitment is to the
  _shape_ (Zod source of truth; committed OpenAPI; types-only client),
  not to any single package.
