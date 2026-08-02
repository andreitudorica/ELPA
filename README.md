# ELPA

ELPA (a temporary name for **Event Logistics and Planning App**) explores a
better way to discover, structure, verify, and recommend providers and offers
for events and experiences.

The project is in its definition phase. The current priority is the internal
data-curation product, **ELPA Data Studio**. The public-facing Recommendation
Product will consume approved data only.

## Repository status

This is a greenfield repository. Architecture, infrastructure, and the
technology stack will be established through documented decisions before the
initial implementation.

ELPA uses a monorepo with three separable applications:

- the shared API;
- the Recommendation Product application, named `frontend`, which consumes the
  shared API;
- ELPA Data Studio, which consumes the same shared API.

The shared API is a single-deployment modular monolith. Each application must
remain independently runnable, testable, buildable, and deployable. Shared code
belongs in explicitly owned packages rather than direct application-to-
application imports.

TypeScript is the primary implementation language across all three
applications. Additional runtimes require a workload-specific justification.
The workspace uses `pnpm` workspaces with Turborepo for task orchestration and
caching.
PostgreSQL is the authoritative operational database and system of record.
Drizzle ORM is the primary persistence toolkit, with Drizzle Studio available
through the repository's development scripts for local database inspection.
The shared API uses NestJS with the Fastify adapter.
It exposes REST/JSON contracts through OpenAPI, with generated TypeScript
clients for both client applications.

The client UI foundation is intentionally undecided. React, TypeScript, and
Material UI are the leading candidates, with the final selection delegated to
the primary client developer.

Initial Recommendation Product flows are anonymous. The Data Studio alpha has a
single Administrator role and uses simulated identity; real authentication is
deferred until after the alpha. The target authentication design delegates
identity to an OpenID Connect provider while ELPA owns invitations, roles,
authorization, and audit data.

Initial infrastructure uses a containerized API, managed PostgreSQL, separately
deployed clients, and Docker Compose for local dependencies. Kubernetes and
self-managed production databases are intentionally out of scope.

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
