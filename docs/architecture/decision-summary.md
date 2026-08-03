# Architecture decision summary

## Product boundary

ELPA consists of two independently runnable, testable, buildable, and
deployable applications in one monorepo:

- `apps/api`: the shared backend and system boundary;
- `apps/web`: one client application hosting the anonymous Recommendation
  Product at `/*` and the internal, Administrator-guarded Data Studio at
  `/studio/*` (ADR 0015).

Both product responsibilities live in one client. Data Studio is the product
name; "Admin Dashboard" describes at most one administrative interface within
it.

## Application architecture

- The API is a single-deployment modular monolith.
- TypeScript is the primary language.
- The monorepo uses `pnpm` workspaces and Turborepo.
- The API uses NestJS with the Fastify adapter.
- The client is React 19 + Vite 8 + Material UI 9, with TanStack Router,
  TanStack Query, Zustand, React Hook Form + Zod, and i18next.
- REST/JSON and OpenAPI define the external contract.
- The client uses a generated TypeScript API client (inside `apps/web`) and
  never imports API implementation types. Distinct DTOs per projection encode
  the published-versus-canonical boundary from ADR 0013 in the generated
  types.
- Route-family separation (`_public` and `_studio`) with two `beforeLoad`
  policies expresses the audience split at the UX layer; the API remains the
  authoritative trust boundary.
- Mock Service Worker (MSW) is the permanent dev, test, and Storybook mock
  backend behind the generated client, gated so it never runs in production
  (ADR 0016); handler types are drift-checked against the generated OpenAPI
  types once the schema exists.
- The frontend chassis is adopted from `react-enterprise-boilerplate`
  alongside its quality tooling — Storybook 10, Vitest 4, Playwright with
  axe, ESLint 10 + Prettier + Husky + Commitlint, Renovate (ADR 0017).

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
- The client application is separately deployable as a static SPA.
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

| Decision                           | Current direction                                                                                              | Owner or trigger                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Cloud provider                     | AWS or Google Cloud, single-provider preference                                                                | Team discussion using cost and managed-service criteria |
| Infrastructure as code             | Not selected                                                                                                   | Select with cloud provider                              |
| OIDC provider                      | Not selected                                                                                                   | Required after protected alpha                          |
| Queue and workers                  | Not selected                                                                                                   | Acquisition experiment measurements                     |
| Recommendation ranking             | Not selected                                                                                                   | Curated evaluation dataset and product experiment       |
| Client split into two applications | Deferred; revisited if Recommendation Product develops SSR/SEO or a materially different UX profile (ADR 0015) | New ADR required to reintroduce                         |

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
