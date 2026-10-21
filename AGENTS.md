# AGENTS.md

Rules for AI coding agents working in this repository. This is the only
agent-instruction file; it holds the rules that apply to every task. The
documents in the scope table are ordinary files that are **not loaded
automatically** — read the ones that match the paths you touch before editing.

## Repository at a glance

- A pnpm-workspace monorepo orchestrated by Turborepo, with two independently
  runnable TypeScript applications and no shared packages yet:
  - `apps/api` — the shared REST API: a NestJS + Fastify modular monolith on
    PostgreSQL through Drizzle, publishing an OpenAPI contract, plus a research
    CLI for batch acquisition work.
  - `apps/web` — one React SPA hosting the anonymous Recommendation Product
    (`/*`) and the Administrator-only Data Studio (`/studio/*`) (ADR 0015).
- Toolchain versions are pinned by `.nvmrc` and `packageManager` in
  `package.json`; use them rather than repeating version numbers elsewhere.
- Applications never import each other's source; the generated API types are
  the only bridge.

## Scope table

| When you work on                                         | Read first                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any task                                                 | [`CONTEXT.md`](./CONTEXT.md), [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md), [`docs/development/agentic-work.md`](./docs/development/agentic-work.md)                                     |
| Architecture, persistence, or contracts                  | [`docs/adr/`](./docs/adr/), [`docs/architecture/`](./docs/architecture/)                                                                                                                         |
| Product scope                                            | [`docs/product/`](./docs/product/)                                                                                                                                                               |
| `apps/api/**`                                            | [`apps/api/README.md`](./apps/api/README.md), [`docs/development/database.md`](./docs/development/database.md)                                                                                   |
| `apps/web/**`                                            | [`apps/web/README.md`](./apps/web/README.md), [`apps/web/docs/architecture.md`](./apps/web/docs/architecture.md), [`identity-boundary.md`](./apps/web/docs/identity-boundary.md)                 |
| `apps/web/src/lib/apiClient/**`, `apps/web/src/mocks/**` | [`apiClient/README.md`](./apps/web/src/lib/apiClient/README.md), [`mocks/README.md`](./apps/web/src/mocks/README.md)                                                                             |
| Research acquisition (`apps/api/src/research/**`)        | [`docs/research/group-rental-property-baseline/`](./docs/research/group-rental-property-baseline/README.md), [`data-acquisition-experiments.md`](./docs/product/data-acquisition-experiments.md) |
| Tests, validation, or these instructions                 | [`docs/development/agentic-work.md`](./docs/development/agentic-work.md)                                                                                                                         |

Working hypotheses in external research or source documents are not
requirements until a document in this repository accepts them.

## Safety and scope

- Ask before committing, pushing, rewriting history, deleting branches,
  merging, publishing, or deploying. Authorization already given for the same
  piece of work does not need to be asked for again.
- Preserve unrelated working-tree changes and stage only the files of your
  task.
- Write commits as Conventional Commits with a scope from
  [`commitlint.config.mjs`](./commitlint.config.mjs) (`web`, `api`, `docs`,
  `infra`, `deps`, `chore`). Husky runs `lint-staged` (Prettier) before each
  commit and commitlint on the message; never bypass hooks or weaken a check
  to obtain a pass.
- Do not add AI-authorship credits or generated-by trailers to commits or pull
  requests unless explicitly asked.
- Never read, print, or commit secrets. `.env.local` files are ignored;
  `.env.example` files are the sanitized reference. Every `VITE_*` variable is
  embedded in the public web bundle, so never put a secret in one.
- The GitHub repository is public. Never commit source artifacts, official
  register rows, personal data, evaluation review sheets, or anything under
  `apps/api/.data/`; commit only aggregates, key-only manifests, and synthetic
  fixtures.
- Keep changes focused and reversible. Report unrelated failures instead of
  fixing them inside the task.
- Write code, identifiers, comments, tests, commit messages, and repository
  documentation in English; translate source material and label any necessary
  quotation in another language.

## Architecture and data authority

- The API is a modular monolith (ADRs 0001, 0020). Domain modules are
  `access`, `research`, `catalog`, `curation`, `recommendation`, and `audit`;
  `common`, `database`, `config`, and `health` are infrastructure. Each domain
  module exposes one barrel (`index.ts`), and other modules import only that
  barrel (ESLint-enforced). Inside a module the flow is controller →
  application service → repository → Drizzle schema.
- Write each kind of data only through its owner:

  | Data                                                                                                                                                                                                   | Owner                    | Contract                                                                                          |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------- |
  | `administrator`                                                                                                                                                                                        | Access                   | Membership; identity is resolved through Access only                                              |
  | `category`, and later Providers, Operating Locations, Offers                                                                                                                                           | Catalog                  | Canonical catalog values                                                                          |
  | `research_campaign`, `research_campaign_source`, `source_artifact`, `acquisition_run`, `evidence`, `acquisition_run_record`, `candidate`, `claim`, `duplicate_suggestion`, `reconciliation_assessment` | Research                 | Evidence and Claims are immutable; `candidate.verification_status` is constrained to `unverified` |
  | `audit_event`                                                                                                                                                                                          | Audit                    | Append-only actor-attributed history                                                              |
  | Verification decisions, canonical value selection, publication, duplicate resolution                                                                                                                   | Curation (not yet built) | Only Curation may turn Claims and suggestions into canonical or published data                    |

- Research proposes and Curation decides (ADR 0013). Never write observed
  values onto canonical records, never mark Candidates verified or published
  from Research, and keep the Recommendation Product on published projections
  only.
- Drizzle schemas live in their owning module. `apps/api/src/drizzle/schema.ts`
  re-exports them for drizzle-kit only; application code never imports it.
- Controllers translate HTTP and stay thin. Long-running work (imports,
  duplicate detection, evaluation exports) runs through the research CLI
  (`apps/api/src/research-cli.ts`), never inside a request. Do not add a
  queue, worker, browser automation, scraper, or extraction vendor without an
  experiment result and an accepted boundary (ADR 0014).
- One CLS store per request or CLI command carries the correlation id, the
  resolved Administrator, and the active transaction. Multi-write use cases
  run inside `UnitOfWork.run`; repositories read `DatabaseService.executor`.
  Never pass transaction handles through signatures (ADR 0021).
- PostgreSQL is the only system of record (ADR 0005); add no other
  authoritative store, search index, or vector database without an accepted
  ADR and a measured requirement. Use Drizzle for schemas, migrations, and
  typed access (ADR 0006), and reviewed SQL through Drizzle's `sql` where a
  complex filter, aggregate, or bulk operation is clearer. Primary keys are
  application-generated UUIDv7; vocabularies are `text` columns with `CHECK`
  constraints, not PostgreSQL enums; JSONB values that may be top-level JSON
  strings use `exactJsonb` (see `docs/development/database.md`).
- Generate migrations with `pnpm db:generate` and commit them with the schema
  change. Never edit a migration that has been applied anywhere — add a new
  one — never use `drizzle-kit push`, and never run migrations on API boot.
- Zod schemas are the single source of request and response validation
  (ADR 0022). Expose a distinct DTO per projection (canonical versus
  published); public routes never reference administrative schemas.
- When an API contract changes, regenerate in the same change and update the
  curated wrappers in `apps/web/src/lib/apiClient/index.ts`, their consumers,
  and any MSW handlers.
- Never hand-edit generated files:

  | File                                               | Generator                                                     | Committed |
  | -------------------------------------------------- | ------------------------------------------------------------- | --------- |
  | `apps/api/openapi.yaml`                            | `pnpm openapi:generate` (root)                                | yes       |
  | `apps/web/src/lib/apiClient/generated/schema.d.ts` | `pnpm --filter @elpa/web codegen` (run by `openapi:generate`) | yes       |
  | `apps/api/drizzle/**`                              | `pnpm db:generate`, reviewed before the first apply           | yes       |
  | `apps/web/src/app/router/routeTree.gen.ts`         | `tsr generate` (runs before `dev`, `build`, and `typecheck`)  | no        |
  | `apps/web/public/mockServiceWorker.js`             | MSW                                                           | no        |
  | `.codebase-memory/graph.db.zst`                    | Codebase Memory MCP `index_repository` with persistence       | yes       |

- Package the API as a portable container and use Docker Compose for local
  PostgreSQL. The hosting provider is undecided (AWS and Google Cloud are
  shortlisted): introduce no provider-specific coupling, Kubernetes, or
  self-managed production database without an accepted ADR (ADR 0011).
- Do not reintroduce a second client application without an ADR superseding
  ADR 0015, and do not add another runtime except behind an explicit,
  documented application or worker boundary.

## Access and trust boundaries

- The API authorizes every request. Administrative controllers use
  `@AdminController(...)`, which mounts them under `/api/admin/*` with
  `AdministratorGuard`; the boot-time route verifier refuses to start
  otherwise.
- Simulated alpha identity (`API_SIMULATED_ADMINISTRATOR_EMAIL`) stays inside
  the Access boundary and is permitted only for `local` or infrastructure-
  protected `private` deployments; environment validation rejects it when
  `API_DEPLOYMENT_VISIBILITY=public`. Do not spread fake-user logic into
  domain modules or controllers.
- After the alpha, an external OpenID Connect provider establishes identity;
  ELPA keeps invitations, membership, roles, authorization, and audit history
  (ADR 0009). Identity-provider claims are not the authorization model.
- In the web app, the `_public` and `studio/_authenticated` route families are
  UX separation, not security (ADR 0015). Today only `studio/_authenticated`
  has a `beforeLoad` guard (`requireAdministrator`); `_public` is open by
  design.
- Keep code under `_public/**` and Recommendation features off the `studio`
  namespace of `@/lib/apiClient`. ESLint blocks that named import, Studio
  routes, and `@/lib/identity` from `_public.tsx` and `_public/**`.
- Record an audit event with the acting Administrator for every sensitive
  mutation, using the Audit module.
- Show raw Evidence only on Administrator-guarded Data Studio routes, after
  retention-policy redaction; never on public routes. Drizzle Studio is local
  development tooling, never an application surface.

## Implementation

- Reuse what exists before adding abstractions: web components, hooks, and
  utilities under `apps/web/src/{components,hooks,lib,utils}`, and the API's
  `common` errors, guards, logger, and `UnitOfWork`. Add a dependency only for
  a concrete reason, documented in the owning application's README.
- Throw typed `AppError` subclasses from `apps/api/src/common/errors/`; the
  exception filter maps them to RFC 7807 `application/problem+json` with a
  `correlation_id`. A new subclass needs a matching filter case.
- Keep the TypeScript strictness configured in each app's `tsconfig*.json`.
  Do not hide type errors with `any`, broad casts, non-null assertions in
  production code, or `eslint-disable`; validate external input with Zod.
- Keep domain logic independent of NestJS, Drizzle, and transport. Pure
  modules such as `apps/api/src/research/acquisition/` and `…/matching/`
  must not import framework or persistence code.
- Use the canonical terms from `UBIQUITOUS_LANGUAGE.md`. Flag a terminology
  conflict instead of introducing a synonym.
- Write comments for non-obvious constraints, decisions, and workarounds only.
- Mind the known performance risks: batch database writes below PostgreSQL's
  65,535 bind-parameter limit, use batch reads across module boundaries rather
  than per-entity calls, stream large source artifacts instead of loading
  them whole, bound pairwise comparisons with blocking, aggregate in SQL, and
  never mirror server data into client stores.
- Formatting and lint rules live in `.prettierrc.json` and each app's ESLint
  config; follow them rather than restating them.

## Product and operational contracts

- User-facing web strings are Romanian, through i18next. Translation keys are
  typed from the `en` resources, so add every key to both
  `apps/web/src/i18n/locales/ro/` and `…/en/`; `en` is a skeleton locale that
  keeps the bilingual infrastructure. Keys and translator comments are English.
- Follow the web state-ownership rules in `apps/web/docs/architecture.md`:
  server state in TanStack Query, URL state in the router, form state in React
  Hook Form + Zod, global client state in Zustand, ephemeral state in
  component state.
- MSW runs only in development, tests, and Storybook (ADR 0016); type handlers
  from the generated schema.
- Use the existing loggers — `nestjs-pino` with correlation ids in the API,
  `apps/web/src/lib/logger` in the web app. Never log secrets, tokens, or
  personal data. There is no analytics or metrics pipeline; do not add one
  without a decision.
- Treat acquisition and extraction as experiments until they pass the
  promotion rule in `docs/product/data-acquisition-experiments.md`: preserve
  Evidence before Claims, keep provenance and observation time on every Claim,
  version every extraction method, redact personal data per the source's
  retention policy, never treat population screening as eligibility, and label
  research figures as observed, estimated, or unverified.
- Update documentation in the same change that alters a domain concept,
  architecture decision, workflow, contract, or developer experience. Every
  runnable application keeps a README covering its purpose, boundary,
  dependencies, commands, configuration, and data ownership. Record an ADR
  only for decisions that are costly to reverse, non-obvious, and chosen
  through a real trade-off.
