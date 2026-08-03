# AGENTS.md

## Mission

Build ELPA from the documented domain language and accepted decisions. Treat
the repository documentation as part of the product: update it in the same
change that alters a domain concept, architecture decision, workflow, or
developer experience.

## Repository language

Use English for all source code, identifiers, comments, tests, commit messages,
and repository documentation. Source material may be in another language, but
translate and normalize it into English before adding it to the repository.
Preserve a source's original language only when quoting it is materially
necessary, and label the quotation accordingly.

User-facing strings in `apps/web` are Romanian; the bilingual i18n
infrastructure is preserved (typed keys, `en` locale files kept as skeletons)
so other locales can be added without redesign. The repository-language rule
above still applies to keys, code, and translator comments.

## Sources of truth

Read these before planning a material change:

1. `CONTEXT.md` for concise domain definitions.
2. `UBIQUITOUS_LANGUAGE.md` for canonical terminology, relationships, and known
   ambiguities.
3. `docs/adr/` for accepted architectural decisions, when present.
4. `docs/architecture/` for system boundaries and the conceptual data model.
5. `docs/product/` for accepted scope and experiment definitions.
6. The nearest application or package `README.md` for local constraints.
7. The root `README.md` for repository-wide orientation.

Do not turn working hypotheses from external research documents into product
requirements or architectural facts without an explicit decision in this
repository.

## Code discovery with Codebase Memory MCP

Prefer Codebase Memory MCP over filesystem search when discovering code or
dependencies:

1. Run `index_repository` when the repository is not indexed; use
   `detect_changes` or re-index after material changes.
2. Use `search_graph` to locate functions, classes, routes, variables, and
   domain implementations.
3. Use `trace_path` for callers, callees, data flow, and impact analysis.
4. Use `get_code_snippet` only after resolving the exact symbol with
   `search_graph`.
5. Use `query_graph` for complex structural questions and `get_architecture`
   for a high-level view.
6. Fall back to `rg` for string literals, error messages, configuration,
   documentation, and files not represented adequately in the graph.

Keep `.codebase-memory/graph.db.zst` current when the shared index materially
changes so other agents can bootstrap quickly.

## Working rules

- Use the repository-pinned Node.js and `pnpm` versions.
- Keep package-level scripts runnable directly; Turborepo orchestrates and
  caches tasks but must not be the only way to execute them.
- Use TypeScript as the primary implementation language across `apps/api` and
  `apps/web`.
- Introduce another runtime only behind an explicit application or worker
  boundary and document the workload that justifies it.
- Use the canonical terms from `UBIQUITOUS_LANGUAGE.md` in code and docs.
- Flag a terminology conflict instead of silently introducing a synonym.
- Keep application boundaries explicit; do not create cross-application imports
  that bypass shared package contracts.
- Treat the backend API as the shared system boundary for both the
  Recommendation Product and Data Studio. The client must not connect
  directly to persistence or create a client-specific backend without an
  accepted architectural decision.
- Treat anonymous Recommendation Product access and administrative Data Studio
  access as distinct trust boundaries. Hosting both audiences in one client
  application (ADR 0015) never implies shared authorization; the API
  enforces authorization on every request, and the client separates the two
  audiences by route family (`_public` versus `_studio`) and by
  audience-scoped API namespaces.
- During the Data Studio alpha, simulated identity and one Administrator role
  are intentional. Keep the simulation isolated behind the authentication
  boundary, visibly configured, and replaceable; do not spread fake-user logic
  through domain modules or controllers.
- Permit simulated identity only in local development or an infrastructure-
  protected private alpha environment. The API must fail to start when
  simulated authentication is enabled in a public production environment.
- Use an external OpenID Connect provider to establish identity. Keep
  invitations, Administrator membership, roles, authorization decisions, and
  audit history in ELPA after alpha; do not treat identity-provider claims as
  the domain authorization model.
- Keep domain logic independent of UI frameworks and deployment adapters.
- Keep persistence access explicit and suitable for relational constraints,
  complex filters, transactions, bulk operations, and reviewed SQL escape
  hatches; do not force important queries through an ORM abstraction that makes
  them less correct or understandable.
- Treat PostgreSQL as the system of record. Do not introduce another persistent
  store, search index, or vector database as an authoritative source without an
  accepted ADR and a measured requirement.
- Use Drizzle ORM for schema definitions, migrations, and type-safe persistence
  access. Keep domain rules independent of Drizzle through module-owned
  repositories or equivalent ports.
- Build the API with NestJS and the Fastify adapter. Controllers translate
  transport concerns; they do not own domain rules, persistence queries, or
  long-running data-processing workflows.
- Treat the generated OpenAPI document as the REST contract authority. The
  client consumes a generated TypeScript client inside
  `apps/web/src/lib/apiClient/` and must not import DTOs or other
  implementation types from `apps/api`.
- Expose distinct DTOs per projection in the OpenAPI contract so that the
  published-versus-canonical boundary from ADR 0013 is encoded in generated
  types (`PublishedOffer` versus `Offer`, etc.). Do not import admin API
  namespaces inside `recommendation/` or under the `_public` layout; the
  ESLint `no-restricted-imports` boundary enforces this and must not be
  weakened without an accepted architectural decision.
- Regenerate and verify the OpenAPI document and client in the same change
  that alters an API contract.
- The client UI foundation is React 19 + TypeScript strict + Material UI 9 +
  Vite 8 with TanStack Router/Query, Zustand, React Hook Form + Zod, and
  i18next, adopted from the `react-enterprise-boilerplate` chassis. Follow
  the state-ownership rules described in `apps/web/docs/architecture.md`
  (server state in TanStack Query, URL state in the router, form state in
  React Hook Form, global client state in Zustand, ephemeral state in
  `useState`); do not mirror server data into Zustand.
- Use the repository script for Drizzle Studio against local development data
  only. Never expose it as an application feature or connect it casually to a
  production database.
- Package the API as a portable container and use Docker Compose for local
  PostgreSQL and supporting services.
- Keep hosting-provider integrations behind explicit infrastructure boundaries.
  The provider is undecided, AWS and Google Cloud are shortlisted, and no agent
  should introduce provider-specific coupling before that decision is accepted.
- Do not introduce Kubernetes or a self-managed production database without an
  accepted ADR backed by concrete operational requirements.
- Separate verified, publishable data from candidates and unverified claims.
- Preserve provenance and verification time for data used by recommendations.
- Treat web discovery and extraction as experiments. Do not add a dedicated
  scraper, queue, browser automation system, or extraction vendor without an
  experiment result and a documented operational boundary.
- Preserve fetched evidence before extraction, and write extracted values as
  proposed Claims rather than canonical Provider or Offer fields.
- Add or update tests with behavioral changes once implementation exists.
- Record an ADR only for decisions that are costly to reverse, non-obvious, and
  selected through a real trade-off.

## Documentation expectations

Every runnable application and reusable package must have a local `README.md`
covering its purpose, boundary, dependencies, local commands, configuration,
and ownership of data or domain concepts. Commands and stack-specific rules
will be added after the stack is selected; do not invent them.

Follow `docs/development/agentic-work.md` for the repository workflow and update
it when the actual scaffold changes commands or validation steps.
