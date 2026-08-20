# Architecture

This directory records the current architectural direction while the solution
is being designed. Confirmed decisions that are costly to reverse and arise
from meaningful trade-offs will move into concise ADRs under `docs/adr/`.

## Confirmed constraints

- The Recommendation Product and Data Studio share one client application,
  `apps/web`, split by route family: `/*` for anonymous public routes and
  `/studio/*` for Administrator-guarded routes. Two pathless layouts encode
  the two `beforeLoad` policies (ADR 0015).
- The client consumes the shared backend API as its system boundary; trust
  boundaries are enforced by the API, not by the client (ADR 0008, ADR 0009).
- The shared API is one backend application and one deployment, structured as
  a modular monolith.
- The two applications (`apps/api`, `apps/web`) live in one monorepo and
  remain independently runnable, testable, buildable, and deployable.
- Applications do not import from one another; reusable contracts and tooling
  belong in explicitly owned shared packages.
- TypeScript is the primary implementation language across both applications.
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
- The shared API exposes REST/JSON contracts described by OpenAPI. The client
  application consumes a generated TypeScript client that lives inside
  `apps/web/src/lib/apiClient/` rather than backend implementation types or
  handwritten request shapes (ADR 0012 as revised by ADR 0015). The API
  exposes distinct DTOs per projection so that the published-versus-canonical
  boundary from ADR 0013 is preserved in the generated types
  (`PublishedOffer` versus `Offer`, etc.), and an ESLint
  `no-restricted-imports` boundary prevents admin API namespaces from being
  imported inside `recommendation/` or under the `_public` layout.
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
  backups, and a separately deployed static client on a managed platform.
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
workflows; those surfaces live under the `_public` route family and consume
only published projections. Data Studio additionally uses research, claims,
verification, publication, and administrative workflows; those surfaces live
under the `_studio` route family and consume canonical, candidate, claim, and
evidence data. Internal module boundaries must remain explicit enough to
permit later extraction of a separate client application or backend service if
operational needs justify it, but independently deployed clients and services
are not part of the initial design.

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
  web/
    src/
      _public/         route family: anonymous Recommendation Product
      _studio/         route family: Administrator-guarded Data Studio
      features/
        recommendation/  public: search, results, explanation surfaces
        access/          admin: session bootstrap; post-alpha: invitations, roles
        research/        admin: Campaigns, Acquisition Runs, Candidates, Evidence, proposed Claims
        catalog/         admin: Providers, Operating Locations, Offers, Categories
        curation/        admin: Verification Decisions, canonical value selection, Publication, Reverification
        audit/           admin: actor-attributed history
        settings/        admin: preferences (theme, language)
      lib/
        apiClient/       generated from the API's OpenAPI document
```

Shared packages are not scaffolded yet. Extraction of reusable pieces into
`packages/*` is deferred until a second consumer justifies it. The identity
provider, post-alpha authorization granularity, observability, concrete
hosting provider, and infrastructure-as-code tooling remain to be decided.

## Open decisions

### Cloud provider

The team prefers a single cloud provider and will most likely select AWS or
Google Cloud. The choice is deferred; low initial cost is the primary selection
criterion, followed by managed PostgreSQL quality, container operations,
private-alpha protection, backup and restore capabilities, and a clean growth
path. Application and infrastructure design must remain portable until the
provider is accepted.
