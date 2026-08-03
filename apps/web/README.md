# `@elpa/web`

The single ELPA client application, hosting both audiences per ADR 0015:

- The anonymous **Recommendation Product** at `/*`.
- The Administrator-guarded **Data Studio** at `/studio/*`.

The chassis was adopted from `react-enterprise-boilerplate` (ADR 0017) and
adapted to ELPA's ADR set. See [`docs/architecture.md`](./docs/architecture.md)
for structure and rationale, and [`docs/identity-boundary.md`](./docs/identity-boundary.md)
for the auth model.

## Stack

| Concern            | Choice                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Build              | Vite 8, TypeScript (strict, type-aware ESLint)                   |
| UI                 | Material UI 9, MUI X Charts (theme-driven, light/dark/system)    |
| Routing            | TanStack Router (file-based, type-safe)                          |
| Server state       | TanStack Query 5                                                 |
| Client state       | Zustand 5 in `src/app/store/` — theme mode, language, UI toggles |
| Forms              | React Hook Form 7 + Zod 4                                        |
| i18n               | i18next / react-i18next (`ro` default, `en` skeleton), date-fns  |
| API mocking        | MSW 2 (dev/test/Storybook only — ADR 0016)                       |
| Tests              | Vitest 4 + Testing Library, Playwright + axe                     |
| Component workshop | Storybook 10 (a11y, docs, interaction, MSW addons — ADR 0017)    |

## Local commands

All scripts run per-app (per AGENTS.md); the monorepo `pnpm turbo` versions
at the root fan out across workspaces.

| Script                                       | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                   | Vite dev server with HMR and the MSW mock backend                 |
| `pnpm build`                                 | Typecheck + production build (`tsc -b && vite build`)             |
| `pnpm preview`                               | Serve the production build locally                                |
| `pnpm typecheck`                             | TypeScript project check                                          |
| `pnpm lint` / `lint:fix`                     | ESLint (type-aware, a11y, import rules, boundary rules)           |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest unit and component tests                                   |
| `pnpm test:e2e` / `test:e2e:ui`              | Playwright end-to-end tests (Chromium in CI, full matrix nightly) |
| `pnpm storybook` / `build-storybook`         | Component workshop                                                |
| `pnpm codegen`                               | Regenerate the OpenAPI client (no-op until `apps/api` exists)     |
| `pnpm analyze`                               | Production build + bundle treemap (`stats.html`)                  |

`pretypecheck`, `prebuild`, and `predev` invoke `tsr generate` so the
TanStack Router route tree (`src/app/router/routeTree.gen.ts`) is regenerated
before every check. The generated tree is gitignored.

## Environment

Validated at startup by `src/lib/env/index.ts` (Zod). See [`.env.example`](./.env.example).
Never add secrets — every `VITE_*` variable is embedded into the public bundle.
There are no identity variables on the client; identity is server-owned
(ADR 0009/0010).

## Boundaries enforced by ESLint

- `_public/**` may not import from `studio/**`, the identity boundary, or
  admin API namespaces (ADR 0015).
- `studio/_authenticated/**` may not import from `_public/**` (symmetric).
- `import 'msw'` is permitted only inside `src/mocks/**` and `src/test/**`
  (ADR 0016).
- Stories may not import routes, guards, identity, or feature modules
  (ADR 0017).

## Adjacent documentation

- Root [`README.md`](../../README.md), [`AGENTS.md`](../../AGENTS.md),
  [`CONTEXT.md`](../../CONTEXT.md), [`UBIQUITOUS_LANGUAGE.md`](../../UBIQUITOUS_LANGUAGE.md).
- [`docs/architecture.md`](./docs/architecture.md) — this app's structure.
- [`docs/identity-boundary.md`](./docs/identity-boundary.md) — auth model.
- [`src/lib/apiClient/README.md`](./src/lib/apiClient/README.md) — generated client contract.
- [`src/mocks/README.md`](./src/mocks/README.md) — MSW policy.
- ADRs under [`../../docs/adr/`](../../docs/adr/).
