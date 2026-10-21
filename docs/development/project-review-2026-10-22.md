# Project review — 22 October 2026

## Scope and constraints

Reviewed both applications, Research experiments, persistence and authorization
boundaries, generated contracts, tests, build tooling, CI and supporting
documentation. Structural exploration used Codebase Memory, followed by source
inspection and executable checks. This is a broad engineering review, not an
independent security audit or a certification of extraction accuracy.

The visual experiment was already present as uncommitted work. A private
snapshot taken at review start distinguishes it from these changes. Existing
experiment inputs, method versions, historical results and unrelated changes
were preserved. No migrations, dependencies, API contracts or product features
were changed by this review. Nothing was committed or pushed.

## Changes made

- **Enforced the documented import boundaries.** Flat ESLint overrides for MSW
  had replaced the web route restrictions. The restrictions now compose, cover
  layout roots and nested routes, and reject the named Studio API import from
  public routes. API domain restrictions cover nested paths and prohibit the
  tooling-only schema aggregate. New probes exercise both forbidden and allowed
  imports against the actual configurations.
- **Removed repeated validation.** App `validate` scripts already run the full
  sequence. Turbo no longer launches that sequence a second time through task
  dependencies, avoiding concurrent route generation. Cached tasks include
  default tracked inputs; relevant tasks also hash local environment files.
- **Closed a Docker build-context gap.** Private `.data/` artifacts and local
  environment files are excluded. Sanitized `.env.example` files remain
  available. This protects the context before a Dockerfile can copy files.
- **Kept runtime persistence within module ownership.** The database adapter
  no longer imports the aggregate migration schema. Existing repositories use
  explicit table queries and require no relational-query schema registration.
- **Consolidated repeated logic.** Campaign creation uses the existing response
  mapper. Reporting, text corpus and visual corpus grouping share the existing
  iterative union-find algorithm while retaining their own grouping criteria.
  This is grouping infrastructure, not automatic entity resolution.
- **Strengthened contract checks.** CI regenerates both OpenAPI and web types
  with sanitized configuration and checks both for drift. Generation was
  verified without database queries.
- **Aligned documentation with the implementation.** Only Studio has a client
  Administrator guard; the public recommendation workflow remains a landing
  placeholder. Test coverage, configuration ownership and reproduction guidance
  now describe the actual system. The Playwright accessibility import uses the
  equivalent named export, removing its lint warning.

## Verification

| Check                                   | Observed result                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Root `pnpm validate`                    | Passed formatting, boundary probes and both app validation sequences                         |
| API unit tests                          | 57 passed across 12 files                                                                    |
| Web unit/component tests                | 12 passed                                                                                    |
| Import-boundary probes                  | 2 passed, with multiple allowed/forbidden cases                                              |
| Chromium end-to-end/accessibility smoke | 2 passed                                                                                     |
| Migration history `pnpm db:check`       | Passed; no review schema changes                                                             |
| Generated OpenAPI and web types         | Byte-for-byte equal to review-start snapshot                                                 |
| Dependency lockfile                     | Byte-for-byte equal to review-start snapshot                                                 |
| Real baseline acquisition report        | Equal before/after excluding only generation timestamp; 42,861 Candidates                    |
| Synthetic corpus characterization       | Equal full output before/after grouping refactor; 13 selected documents, 16 groups           |
| Docker context                          | Sanitized example copy succeeded; private artifact copy failed because the file was excluded |

The characterization output SHA-256 was
`4be32f5225b08b87691e0ffdaae0aa9b653db5f6cde1c0fa06c5081915b42d6c`
before and after. Additional grouping tests cover order independence, repeated
edges, singletons and a 12,000-node chain without recursive traversal.

Root validation now schedules two app validation tasks instead of ten
overlapping tasks. Local elapsed times are not a controlled performance
benchmark. No production load test, full container build, deployment or hosted
CI run was performed as part of this review.

## Findings requiring a behavior decision

These findings remain open because this task explicitly preserves functionality.
They should have focused regression tests and an agreed behavior change.

| Priority                           | Finding                                                                                                   | Consequence and next step                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before public deployment           | `apps/web/src/main.tsx` gates MSW by configured application environment, not Vite production build mode   | A production build configured as development with mocks enabled can start the worker. Add a build-mode guard and test the configuration matrix. API authorization remains independently enforced.          |
| Before handling sensitive failures | `apps/api/src/research-cli.ts` and `apps/api/src/common/http/exception-filter.ts` log complete exceptions | Database exceptions may contain SQL parameters or source material. Review redaction and log safe metadata while retaining useful diagnostics. No actual disclosure was induced or observed in this review. |
| Error usability                    | `apps/web/src/lib/api/client.ts` parses `application/json` but not the API's `application/problem+json`   | Problem details, field errors and correlation information are discarded. Recognize structured JSON media types and test real Problem responses.                                                            |
| Evaluation semantics               | `apps/api/src/research/evaluation/metrics.ts` returns null F1 when precision and recall are both zero     | This conflates an observed zero score with an undefined score. Agree and version the reporting convention before changing historical comparisons.                                                          |

## Remaining limits

- There is no isolated API/database integration-test tier. Unit checks and a
  read-only real-data report do not prove every transaction or audit path.
- The initial register/OSM adapters still lack direct automated coverage.
- Independent annotation and live model evaluation remain incomplete in the
  research experiments. Passing engineering checks does not establish their
  semantic accuracy or commercial value.
- The public landing placeholder still needs product implementation and full
  localization before it represents the planned Recommendation Product.

Use the commands in [agentic work](./agentic-work.md) to reproduce validation.
Real-data report comparisons require the existing private local corpus and
database; those inputs and reports are intentionally excluded from this public
repository.
