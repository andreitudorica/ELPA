# Agentic work

## Goal

Make changes small, inspectable, and safe for both people and agents. The
monorepo permits atomic contract-and-consumer changes, while explicit package
and module boundaries prevent a shared repository from becoming shared global
state.

## Start of a task

1. Read the root `AGENTS.md` and the nearest local `README.md`.
2. Read `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, relevant architecture documents,
   and accepted ADRs.
3. Inspect the Codebase Memory index. Run `index_repository` if absent and
   `detect_changes` or re-index when stale.
4. Use `search_graph`, `trace_path`, and `get_code_snippet` before filesystem
   search for code discovery; use `rg` for documentation, configuration, and
   literals.
5. State the intended boundary and acceptance evidence before editing.

## Change shape

- Prefer a vertical slice that crosses API, generated client, and the
  client-application feature over disconnected layer scaffolding.
- Keep application imports one-way; `apps/web` and `apps/api` never import
  each other's source, only the generated client that mediates them.
- Keep NestJS controllers thin and domain rules independent from NestJS,
  Drizzle, and transport DTOs.
- Change OpenAPI, the generated client, consumers, tests, and documentation in
  the same change.
- Inside `apps/web`, keep the audience split explicit: `_public` routes and
  the `recommendation/` feature consume only published projections through
  the public API namespace; `_studio` routes and the admin features
  (`access/`, `research/`, `catalog/`, `curation/`, `audit/`) consume the
  administrative API namespace. Do not weaken the ESLint boundary that
  enforces this.
- Preserve source-attributed Claims and auditability in every data mutation.
- Treat acquisition automation as an experiment until it passes the promotion
  rule in `docs/product/data-acquisition-experiments.md`.

## Intended repository validation contract

The initial scaffold must expose stable root commands with package-level
equivalents:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm openapi:check
pnpm db:check
```

These names are the desired developer contract, not evidence that the commands
already exist. `pnpm openapi:check` verifies that the client generated inside
`apps/web/src/lib/apiClient/` matches the current API's OpenAPI document.
Update this document when the workspace is scaffolded.

## Finishing a task

1. Run the smallest relevant checks during development, then the complete
   affected validation set.
2. Run `git diff --check` and review the final diff for unrelated changes.
3. Update domain, architecture, operation, and local README documentation in the
   same change.
4. Refresh the Codebase Memory index after material code changes and include the
   shared artifact when it materially changes.
5. Report what was verified and any deferred decision or residual risk.

## Agent guardrails

- Do not turn source-document hypotheses into accepted requirements silently.
- Do not choose the cloud provider while that decision is open.
- Do not resurrect the two-client-application split without a new ADR that
  supersedes ADR 0015; a route family in `apps/web` is the accepted expression
  of the audience split.
- Do not bypass simulated-authentication environment restrictions.
- Do not expose Drizzle Studio or raw evidence as production application
  surfaces.
- Do not introduce another database, a queue, a browser farm, or a scraper
  framework without evidence and an accepted boundary.
