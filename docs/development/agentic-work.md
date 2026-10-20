# Agentic work

How changes are made, validated, and tested in this repository. The rules that
apply to every task live in [`AGENTS.md`](../../AGENTS.md); this document holds
the workflow detail it links to.

## Goal

Make changes small, inspectable, and safe for both people and agents. The
monorepo permits atomic contract-and-consumer changes, while explicit package
and module boundaries prevent a shared repository from becoming shared global
state.

## Start of a task

1. Read `AGENTS.md` and the documents its scope table names for the paths you
   will touch.
2. Record the working-tree state (`git status`) and leave unrelated changes
   untouched.
3. Discover code structurally. When the Codebase Memory MCP server is
   available, check the index (`index_status` / `detect_changes`), re-index if
   it is stale, then use `search_graph`, `trace_path`, and `get_code_snippet`.
   Fall back to `rg` for literals, configuration, documentation, and anything
   the index misses.
4. State the intended boundary and the evidence that will show the change
   works before editing.

## Change shape

- Prefer a vertical slice that crosses the API, the generated contract, and
  the client feature over disconnected layer scaffolding. Do not scaffold empty
  layers, features, or packages ahead of need.
- Keep package-level scripts runnable directly; Turborepo orchestrates and
  caches them but must not be the only way to run them.
- Ship a contract change with its regenerated files, consumers, mocks, and
  documentation (the rule and generator list are in `AGENTS.md`).

## Validation

Run the smallest relevant check while working, then the affected set before
handing off.

| Check                          | Command                                                                | Notes                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everything CI validates        | `pnpm validate`                                                        | `prettier --check .`, then per app `lint → typecheck → test → build` through Turborepo                                                            |
| Formatting (includes Markdown) | `pnpm format:check`                                                    | Enough on its own for documentation- or instruction-only changes                                                                                  |
| One app                        | `pnpm --filter @elpa/api validate`, `pnpm --filter @elpa/web validate` | Or a single script such as `lint`, `typecheck`, `test`                                                                                            |
| API contract and client        | `pnpm openapi:generate`, then confirm it produced no new diff          | `pnpm openapi:check` runs the generator and `git diff --exit-code` against the index, so stage your own changes first or it reports them as drift |
| Migration history              | `pnpm db:check`                                                        | Loads `apps/api/.env.local` (`DATABASE_URL` and the other required variables)                                                                     |
| End-to-end and a11y smoke      | `pnpm --filter @elpa/web exec playwright test --project=chromium`      | Requires installed Playwright browsers; starts the Vite dev server itself                                                                         |
| Whitespace                     | `git diff --check`                                                     | Before handoff                                                                                                                                    |

What CI actually enforces ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)):
`pnpm validate`; `pnpm turbo run codegen` followed by `git diff --exit-code
apps` (regenerates web types from the **committed** `openapi.yaml`); and the
Chromium Playwright project. A nightly workflow runs the full browser matrix.
CI does **not** regenerate `openapi.yaml` from API code, does not run
`db:check`, has no PostgreSQL, and does not build Storybook — run those
locally when your change touches them.

If a check cannot run (Docker not started, browsers not installed, a missing
environment file), report it as not run rather than as passing.

## Testing

### Tiers

| Tier                        | Location and discovery                        | Configuration                                                                   | Command                                                 |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| API unit                    | `apps/api/src/**/*.test.ts`, next to the code | Vitest defaults (no config file), Node                                          | `pnpm --filter @elpa/api test`                          |
| Web unit and component      | `apps/web/src/**/*.test.{ts,tsx}`             | `test` block in `apps/web/vite.config.ts`, jsdom, `src/test/setup.ts`           | `pnpm --filter @elpa/web test`                          |
| Web end-to-end and a11y     | `apps/web/e2e/*.spec.ts`                      | `apps/web/playwright.config.ts`                                                 | `pnpm --filter @elpa/web test:e2e`                      |
| Component workshop          | `apps/web/src/**/*.stories.tsx`               | `apps/web/.storybook/`                                                          | `pnpm --filter @elpa/web storybook` / `build-storybook` |
| Acquisition reproducibility | Research CLI runs against real artifacts      | [`reproduction.md`](../research/group-rental-property-baseline/reproduction.md) | `pnpm --filter @elpa/api research …` (manual, not CI)   |

There is no API integration or contract-test tier yet. `apps/api` reserves the
`*.int.test.ts` and `*.e2e.test.ts` names (excluded from its build), but no
harness, database setup, or CI job exists; adding one is a deliberate change
with its own setup, not something to assume. The acquisition slice currently
has no automated tests by decision (recorded in the
[baseline README](../research/group-rental-property-baseline/README.md)).

### Harness facts

Web paths below are relative to `apps/web`.

- **API:** Vitest compiles TypeScript without `emitDecoratorMetadata`, so
  NestJS cannot inject constructor dependencies by type in tests. Construct
  classes directly with explicit collaborators, and keep business rules in
  pure modules that need no container. Environment validation (`loadEnv`)
  requires the variables from `.env.example`.
- **Web unit:** `src/test/setup.ts` starts the MSW node server with
  `onUnhandledRequest: 'error'`, resets handlers and `localStorage` after each
  test, and initialises i18n in English. Add a typed handler in
  `src/mocks/handlers/` for every request a test triggers. Render through
  `src/test/testUtils.tsx` to get the app providers.
- **Web end-to-end:** Playwright starts `pnpm dev`, so the MSW browser worker
  is active by default. A test that must bypass it sets
  `window.__ELPA_E2E_DISABLE_MOCKS__` with `page.addInitScript` and stubs
  requests at Playwright's network layer (see `e2e/smoke.spec.ts`). No project
  runs against the live API.
- **Stories:** limited to components, layouts, and theme (ESLint-enforced).

### Principles

- Add or update tests with behavioural changes once a harness exists for that
  code; add a regression test where it would have caught the bug.
- Test observable behaviour with independently derived expectations rather
  than restating the implementation.
- Keep exact business-rule matrices (normalisation, screening, matching
  decisions, scoring) at the unit level on pure modules; reserve end-to-end
  tests for integration seams.
- Use synthetic fixtures generated in tests. Never commit real register rows,
  downloaded artifacts, or personal data — the repository is public.
- Make setup deterministic and waits outcome-based (`await expect(...)`,
  locators, `waitFor`); never use fixed sleeps.
- Isolate shared state (MSW handlers, `localStorage`, environment caches, any
  database) per test, and clean up only what the test created.
- Do not depend on live external services in automated tests.

## Finishing a task

1. Run the affected validation from the table above and `git diff --check`.
2. Review the diff for unrelated changes, generated files edited by hand, and
   sensitive content.
3. Update domain, architecture, operational, and README documentation in the
   same change.
4. After material code changes, refresh the Codebase Memory index with
   persistence when the server is available, and include
   `.codebase-memory/graph.db.zst` if it changed.
5. Report what was verified, what was not run and why, and any deferred
   decision or residual risk.

## Writing instructions

- Keep rules that apply to every task in `AGENTS.md`, and detail in the
  documents its scope table names. State each rule once and link to it
  elsewhere.
- Update the scope table when you add, move, or remove a scoped guide. Do not
  create tool-specific copies (`CLAUDE.md`, rule directories) unless a tool
  that the team uses requires one.
- Verify every command, path, generated-file claim, and enforcement claim
  against the configuration before writing it. Label targets and aspirations as
  such instead of stating them as enforced.
- Write one actionable imperative per bullet. Link to configuration instead of
  copying lint rules or version numbers.
- Fix stale or contradictory rules where they are defined instead of adding
  exceptions elsewhere.
- For instruction-only changes, run `pnpm format:check`; run application
  checks only when behaviour could be affected.
