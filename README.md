# ELPA

ELPA (a temporary name for **Event Logistics and Planning App**) explores a
better way to discover, structure, verify, and recommend providers and offers
for events and experiences.

The project is in its definition phase. The current priority is the internal
data-curation product, **ELPA Data Studio**. The public-facing Recommendation
Product will consume approved data only.

## Repository status

Definition-phase repository with the frontend chassis in place. The
monorepo uses `pnpm` workspaces and Turborepo:

- `apps/api`: the shared REST API, a single-deployment modular monolith
  (not yet scaffolded — its own decision session).
- `apps/web`: **scaffolded from `react-enterprise-boilerplate` and adapted
  to ELPA's ADR set** (ADR 0015/0016/0017). Hosts both the anonymous
  Recommendation Product (`/*`) and Administrator-guarded ELPA Data Studio
  (`/studio/*`), separated by route family and by two `beforeLoad` policies.
  See [`apps/web/README.md`](./apps/web/README.md).

Each application remains independently runnable, testable, buildable, and
deployable. Shared code belongs in explicitly owned packages rather than
direct application-to-application imports. The single-client posture is
recorded in ADR 0015 and is revisited only if the Recommendation Product
develops SSR, SEO, or a materially different UX profile.

TypeScript is the primary implementation language across both applications.
Additional runtimes require a workload-specific justification. The workspace
uses `pnpm` workspaces with Turborepo for task orchestration and caching.
PostgreSQL is the authoritative operational database and system of record.
Drizzle ORM is the primary persistence toolkit, with Drizzle Studio available
through the repository's development scripts for local database inspection.
The shared API uses NestJS with the Fastify adapter. It exposes REST/JSON
contracts through OpenAPI, with a generated TypeScript client that lives
inside `apps/web`.

The client UI foundation is React 19 + TypeScript (strict) + Material UI 9 +
Vite 8, adopted from the `react-enterprise-boilerplate` chassis. Server state
is TanStack Query 5; routing is TanStack Router (file-based, type-safe);
client state is Zustand 5; forms are React Hook Form 7 with Zod 4 schemas;
i18n is i18next. The user-facing language is Romanian; the bilingual
infrastructure is preserved for future locales.

Initial Recommendation Product flows are anonymous. The Data Studio alpha has a
single Administrator role and uses simulated identity; real authentication is
deferred until after the alpha. The target authentication design delegates
identity to an OpenID Connect provider while ELPA owns invitations, roles,
authorization, and audit data.

Initial infrastructure uses a containerized API, managed PostgreSQL, a
separately deployed static client, and Docker Compose for local dependencies.
Kubernetes and self-managed production databases are intentionally out of
scope.

## Documentation

- [Domain context](./CONTEXT.md)
- [Ubiquitous Language](./UBIQUITOUS_LANGUAGE.md)
- [Agent instructions](./AGENTS.md)
- [Architecture direction](./docs/architecture/README.md)
- [Decision summary](./docs/architecture/decision-summary.md)
- [System overview](./docs/architecture/system-overview.md)
- [Data model](./docs/architecture/data-model.md)
- [Data Studio alpha](./docs/product/data-studio-alpha.md)
- [Data acquisition experiments](./docs/product/data-acquisition-experiments.md)
- [Agentic work](./docs/development/agentic-work.md)
- [Database development workflow](./docs/development/database.md)
- [Product source document (Romanian)](https://docs.google.com/document/d/1jL7QwXgTn8K2s6qbO2hBatXqevpWLSn69IcIJNVqwLk/edit)
- [Architecture handoff document (Romanian)](https://docs.google.com/document/d/1ISfLqbG06SliOgI7V1NMtbWm4F7qKOCnhZGcGqYyMLk/edit)

Architecture decisions that meet the ADR threshold will be stored under
`docs/adr/`. Design and operational documentation will be added as decisions
are confirmed.
