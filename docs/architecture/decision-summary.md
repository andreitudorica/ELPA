# Architecture decision summary

## Product boundary

ELPA initially consists of three independently runnable, testable, buildable,
and deployable applications in one monorepo:

- `api`: the shared backend and system boundary;
- `frontend`: the public Recommendation Product;
- `data-studio`: the internal research and curation product.

Both clients consume the same API. Data Studio is the product name; “Admin
Dashboard” describes at most one administrative interface within it.

## Application architecture

- The API is a single-deployment modular monolith.
- TypeScript is the primary language.
- The monorepo uses `pnpm` workspaces and Turborepo.
- The API uses NestJS with the Fastify adapter.
- REST/JSON and OpenAPI define the external contract.
- Both clients use a generated TypeScript API client and never import API
  implementation types.

## Persistence and processing

- PostgreSQL is the authoritative system of record.
- Drizzle is the schema, migration, and type-safe persistence toolkit; reviewed
  SQL remains valid for complex PostgreSQL operations.
- Drizzle Studio is pinned development tooling and is never a production
  administration surface.
- Researched values are immutable, source-attributed Claims.
- Verification selects canonical values, and publication exposes approved
  projections without erasing provenance or decision history.
- Acquisition starts manually and advances through measured experiments.
  Automation proposes Candidates and Claims but never publishes them.
- Queue, worker, browser automation, and extraction-vendor choices are deferred
  until experiments reveal real runtime needs.

## Access and security

- Recommendation Product use is anonymous initially.
- Data Studio alpha has one full-access Administrator role.
- Alpha identity is simulated only locally or behind private infrastructure
  protection and fails closed in public production.
- After alpha, identity is delegated to an external OIDC provider; ELPA owns
  invitations, membership, roles, authorization, and audit history.

## Infrastructure direction

- The API is packaged as a portable container.
- Hosted environments use managed PostgreSQL with backups.
- Client applications are separately deployable.
- Docker Compose supplies local PostgreSQL and supporting services.
- Kubernetes and self-managed production databases are excluded initially.
- A single provider is preferred; AWS and Google Cloud remain under discussion,
  with low initial cost as the primary selection criterion.

## Agentic-work foundation

- Repository documentation is written in English and changes with the code.
- `AGENTS.md` makes domain, architecture, and local READMEs the working context.
- Codebase Memory MCP is the preferred code-discovery mechanism, and its shared
  artifact is stored under `.codebase-memory/`.
- Application boundaries prohibit direct cross-application imports.
- Stable root validation commands are specified for the future scaffold.
- UI and cloud decisions remain guarded so agents do not turn candidates into
  accidental standards.

## Explicit open decisions

| Decision | Current direction | Owner or trigger |
| --- | --- | --- |
| Client UI foundation | React, TypeScript, and Material UI are leading candidates | Alin confirms before client scaffolding |
| Cloud provider | AWS or Google Cloud, single-provider preference | Team discussion using cost and managed-service criteria |
| Infrastructure as code | Not selected | Select with cloud provider |
| OIDC provider | Not selected | Required after protected alpha |
| Queue and workers | Not selected | Acquisition experiment measurements |
| Recommendation ranking | Not selected | Curated evaluation dataset and product experiment |

## Implementation starting point

Build one tracer-bullet vertical slice for one category and geography:

```text
Research Campaign
  -> manual Candidate
  -> Evidence and Claims
  -> duplicate review
  -> canonical Provider and Offer
  -> Verification Decision
  -> Publication
  -> public REST read through the generated client
```

This proves the hardest architectural boundary—unverified observations versus
published canonical data—before adding acquisition automation or catalog
breadth.
