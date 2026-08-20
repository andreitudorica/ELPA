# `@elpa/api`

The ELPA shared REST API — a NestJS + Fastify modular monolith
(per ADR 0001 / 0007). Consumed by `@elpa/web` via a generated
TypeScript client (ADR 0012).

**Status:** runnable POC with PostgreSQL persistence, simulated local
Administrator identity, generated OpenAPI, and the first Research Campaign
vertical slice. See ADRs 0020–0022 for the module, persistence, and API
conventions.

## Boundary and data ownership

`AppModule` composes the Access, Research, Catalog, Curation, Recommendation,
and Audit modules. Research owns Research Campaigns and their investigated
sources; Catalog owns Categories; Access owns Administrator membership; Audit
owns immutable mutation history. Repositories use the shared Drizzle adapter,
while multi-write use cases join the transaction stored in request CLS.

## Local commands

| Script                                       | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                   | Nest watch-mode dev server                               |
| `pnpm build`                                 | Nest production build (`nest build`)                     |
| `pnpm start`                                 | Run the built artifact (`node dist/main.js`)             |
| `pnpm db:generate`                           | Generate a reviewed Drizzle migration                    |
| `pnpm db:migrate`                            | Apply committed migrations                               |
| `pnpm db:check`                              | Validate migration history                               |
| `pnpm db:studio`                             | Inspect local data with Drizzle Studio                   |
| `pnpm openapi:generate`                      | Build and regenerate `openapi.yaml`                      |
| `pnpm typecheck`                             | TypeScript project check                                 |
| `pnpm lint` / `lint:fix`                     | ESLint                                                   |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest unit tests                                        |
| `pnpm validate`                              | `lint → typecheck → test → build`; run before every push |

## Environment

Validated at boot by `src/config/env.ts` (Zod). Missing or malformed
values fail fast — no silent production defaults. See
[`.env.example`](./.env.example). Copy to `.env.local` for local
development; never commit real values.

For the checked-in Docker Compose database, the example values work as-is.
From the repository root:

```sh
cp apps/api/.env.example apps/api/.env.local
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api dev
```

The API has no startup schema mutation. A fresh database must be migrated
explicitly before administrative requests are usable.

## Endpoints

| Route                                | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `GET /api/healthz`                   | Process liveness; does not touch PostgreSQL.       |
| `GET /api/readyz`                    | Readiness; confirms PostgreSQL is reachable.       |
| `GET /api/me`                        | Resolve the configured Administrator membership.   |
| `GET /api/admin/research-campaigns`  | List Research Campaigns, newest first.             |
| `POST /api/admin/research-campaigns` | Create and audit a Group Rental Property campaign. |

Every response echoes `X-Correlation-Id`. Administrative routes fail closed
and are guarded through the Access-owned identity resolver. Simulated identity
is accepted only for `local` or infrastructure-protected `private` visibility;
configuration validation refuses it for `public` deployments.

The portable API image is defined by [`Dockerfile`](./Dockerfile). PostgreSQL
migrations remain a separate release/development step rather than mutating the
schema during application startup.
