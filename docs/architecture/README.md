# Architecture

This directory records the current architectural direction while the solution
is being designed. Confirmed decisions that are costly to reverse and arise
from meaningful trade-offs will move into concise ADRs under `docs/adr/`.

## Confirmed constraints

- The Recommendation Product frontend and Data Studio are separate client
  applications.
- The Recommendation Product application is named `frontend` in the repository;
  “Recommendation Product” remains its domain responsibility.
- Both clients consume the same backend API as their system boundary.
- The shared API is one backend application and one deployment, structured as a
  modular monolith.
- The three applications live in one monorepo and remain independently
  runnable, testable, buildable, and deployable.
- Applications do not import from one another; reusable contracts and tooling
  belong in explicitly owned shared packages.
- TypeScript is the primary implementation language across all three
  applications.
- A different runtime, such as Python for extraction workloads, may be added
  only behind an explicit boundary when concrete requirements justify it.
- The monorepo uses `pnpm` workspaces and Turborepo. Package-level tasks remain
  directly executable even when Turborepo orchestrates or caches them.
- Persistence must support relational integrity, complex filtering,
  transactions, bulk data operations, migrations, and transparent access to SQL
  when an ORM abstraction is insufficient.
- PostgreSQL is the authoritative operational database and system of record.
  PostgreSQL-native capabilities such as JSONB, full-text search, trigram
  indexes, and PostGIS may be adopted when their use cases are defined.
- A search engine, vector store, or other secondary database may be introduced
  only for a measured requirement and must not silently become a competing
  source of truth.
- Drizzle ORM is the primary persistence toolkit. Domain modules own their
  persistence boundaries, and complex PostgreSQL operations may use reviewed
  SQL when that is clearer or more capable than the ORM query API.
- The API uses NestJS with the Fastify adapter. NestJS modules express the
  modular-monolith boundaries; transport controllers remain thin, and data
  processing is implemented in application or domain services behind those
  boundaries.
- The shared API exposes REST/JSON contracts described by OpenAPI. Both client
  applications consume a generated TypeScript client package rather than
  backend implementation types or handwritten request shapes.
- Initial Recommendation Product workflows permit anonymous Users. The Data
  Studio alpha has one full-access Administrator role and simulated identity;
  real authentication is deferred until after alpha.
- Public and internal API capabilities have explicit authorization boundaries
  even though they share one application and deployment.
- Authentication delegates identity proof to an external OpenID Connect
  provider after alpha. ELPA remains authoritative for invitations,
  Administrator membership, roles, authorization decisions, and audit history.
- Simulated alpha identity is permitted only in local development or an
  infrastructure-protected private alpha environment. The API must fail closed
  if simulation is enabled for a public production deployment.
- Initial hosting uses a containerized API, managed PostgreSQL with automated
  backups, and separately deployed client applications on managed platforms.
- Local dependencies run through Docker Compose. Kubernetes and self-managed
  production databases are excluded until measured requirements justify their
  operational cost.
- Public and internal capabilities are separated through API contracts and
  authorization, not through application-specific backends.
- Data Studio is the canonical name of the internal data-curation product;
  “Admin Dashboard” describes at most one interface within that product.
- Researched values are preserved as source-attributed Claims. Verification
  selects canonical values, and published records project approved canonical
  data without erasing claim history.
- Data acquisition is manual-first and experimental. Dedicated scrapers are
  introduced only for sources that repeatedly produce valuable, legally usable
  data with acceptable maintenance cost.

The Recommendation Product uses published data and user-facing recommendation
workflows. Data Studio additionally uses research, claims, verification,
publication, and administrative workflows. Internal module boundaries must
remain explicit enough to permit later extraction if operational needs justify
it, but independently deployed services are not part of the initial design.

Detailed views:

- [System overview](./system-overview.md)
- [Conceptual data model](./data-model.md)
- [Data Studio alpha scope](../product/data-studio-alpha.md)
- [Data acquisition experiments](../product/data-acquisition-experiments.md)

## Repository shape

The accepted top-level application structure is:

```text
apps/
  api/
  frontend/
  data-studio/
packages/
  api-client/
```

The concrete shared packages and their ownership boundaries remain to be
designed. The identity provider, post-alpha authorization granularity,
observability, concrete hosting provider, and infrastructure-as-code tooling
remain to be decided.

## Open decisions

### Client UI foundation

Alin, as the developer expected to work most closely with the client
applications, owns the final recommendation for their UI foundation. React with
TypeScript and Material UI is the leading candidate, but it is not accepted yet.
No agent should scaffold either client application around that candidate until
the decision is confirmed.

### Cloud provider

The team prefers a single cloud provider and will most likely select AWS or
Google Cloud. The choice is deferred; low initial cost is the primary selection
criterion, followed by managed PostgreSQL quality, container operations,
private-alpha protection, backup and restore capabilities, and a clean growth
path. Application and infrastructure design must remain portable until the
provider is accepted.
