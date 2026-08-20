# `@elpa/api`

The ELPA shared REST API — a NestJS + Fastify modular monolith
(per ADR 0001 / 0007). Consumed by `@elpa/web` via a generated
TypeScript client (ADR 0012).

**Status:** Phase A scaffolding — baseline app only. Persistence,
identity plumbing, OpenAPI generation, six-module boundaries, and CI
integration land in subsequent commits on the `chore/scaffold-api`
branch. See `docs/adr/0020` – `docs/adr/0022` for the scaffolding
decisions.

## Local commands

| Script                                       | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                   | Nest watch-mode dev server                               |
| `pnpm build`                                 | Nest production build (`nest build`)                     |
| `pnpm start`                                 | Run the built artifact (`node dist/main.js`)             |
| `pnpm typecheck`                             | TypeScript project check                                 |
| `pnpm lint` / `lint:fix`                     | ESLint                                                   |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest unit tests                                        |
| `pnpm validate`                              | `lint → typecheck → test → build`; run before every push |

## Environment

Validated at boot by `src/config/env.ts` (Zod). Missing or malformed
values fail fast — no silent production defaults. See
[`.env.example`](./.env.example). Copy to `.env.local` for local
development; never commit real values.

## Endpoints (Phase A commit 1)

| Route              | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `GET /api/healthz` | Liveness probe. Returns `{ status: 'ok' }`. |
