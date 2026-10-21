# `@elpa/api`

The ELPA shared REST API — a NestJS + Fastify modular monolith
(per ADR 0001 / 0007). Consumed by `@elpa/web` via a generated
TypeScript client (ADR 0012).

**Status:** runnable POC with PostgreSQL persistence, simulated local
Administrator identity, generated OpenAPI, the first Research Campaign
vertical slice, and the Group Rental Property acquisition baseline
(`docs/research/group-rental-property-baseline/`). See ADRs 0020–0023 for the
module, persistence, API, and Evidence conventions.

## Boundary and data ownership

`AppModule` composes the Access, Research, Catalog, Curation, Recommendation,
and Audit modules. Research owns Research Campaigns and their investigated
sources; Catalog owns Categories; Access owns Administrator membership; Audit
owns immutable mutation history. Repositories use the shared Drizzle adapter,
while multi-write use cases join the transaction stored in request CLS.

Research also owns the acquisition baseline: Source Artifacts, Acquisition
Runs, Evidence, per-run record outcomes, unverified Candidates, proposed
Claims, and Duplicate Suggestions. Its pure parts live in
`src/research/acquisition/` (source adapters, normalisation, OSM PBF and XLSX
readers, population screening), `src/research/matching/` (duplicate matcher),
and `src/research/evaluation/` (partition, sampling, scoring); none of them
depend on NestJS or Drizzle. Nothing in Research writes Catalog records or
verification state; the `candidate` and `claim` tables constrain their status
to `unverified` and `proposed`.

`src/research/grouping/` supplies the shared deterministic union-find algorithm
for report and corpus grouping. Each caller retains its own grouping rules;
this utility does not resolve duplicates or merge Candidates. Repositories use
explicit schema-table queries; the aggregate Drizzle schema is tooling-only.

## Local commands

| Script                                       | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                   | Nest watch-mode dev server                               |
| `pnpm build`                                 | Nest production build (`nest build`)                     |
| `pnpm start`                                 | Run the built artifact (`node dist/main.js`)             |
| `pnpm db:generate`                           | Generate a reviewed Drizzle migration                    |
| `pnpm db:migrate`                            | Apply committed migrations                               |
| `pnpm db:check`                              | Validate migration history                               |
| `pnpm db:studio`                             | Inspect local data with Drizzle Studio                   |
| `pnpm openapi:generate`                      | Build and regenerate `openapi.yaml`                      |
| `pnpm research <command>`                    | Research CLI (requires `pnpm build`); see below          |
| `pnpm typecheck`                             | TypeScript project check                                 |
| `pnpm lint` / `lint:fix`                     | ESLint                                                   |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest unit tests                                        |
| `pnpm validate`                              | `lint → typecheck → test → build`; run before every push |

## Research CLI

Acquisition is a long-running batch workload, so it runs from
`src/research-cli.ts` with the same services, transactions, and audit trail as
the API, never inside an HTTP request. It acts as the configured
Administrator. Commands: `fetch`, `baseline-campaign`, `import`, `match`,
`report`, `evaluation-sample`, `evaluation-score` (`pnpm research help`).
Artifacts, reports, and evaluation exports go to the ignored `.data/`
directory. Full workflow and expected outputs:
`docs/research/group-rental-property-baseline/reproduction.md`.

The bounded Overture follow-up adds `sample-overture`, `next-source-campaign`,
`incremental-report`, and `incremental-score`. It uses the same Research
Evidence/Claim and matching boundaries, keeps the original baseline separate,
and does not promote a source to production. Its fixed-release export uses
DuckDB as optional one-off experiment tooling; the API has no DuckDB or Python
runtime dependency. Protocol, permissions, private input requirements, expected
results, and the **investigate further** decision are in
[`next-source-value`](../../docs/research/next-source-value/README.md).

The attribute-extraction CLI adds `extraction-corpus`, `extraction-run`,
`extraction-score`, `extraction-report` and `extraction-ai-import`. It reprocesses
existing immutable Evidence, records `extract` Acquisition Runs and acting
Administrator audit events, and proposes span-grounded Claims only. Contradictory
observations survive alongside earlier methods; repeated identical processing
does not duplicate Claims. Pure ontology/projection/rules/scoring modules live in
`src/research/extraction/`. No model SDK, paid call, queue or new runtime is
introduced. Independent annotations and AI execution remain incomplete; see
the [protocol, results and reproduction commands](../../docs/research/attribute-extraction/README.md).

The bounded visual experiment adds `visual-corpus`, `visual-replay`,
`visual-ai-import` and `visual-score`. It acquires only three direct licensed
Commons references already present in OSM Evidence; it does not crawl galleries.
The pinned `sharp` dependency decodes real image bytes, enforces format/pixel
limits, applies orientation, computes a versioned dHash and removes metadata from
private PNG previews. Original SHA-256, source SHA-1, per-file permissions and
Candidate/parent-Evidence relationships are retained. Files stay under ignored
`.data/visual/`, never the public repository.

The captured-vision adapter has no live provider dependency. It validates rights
attestations, exact image/context references and structured output before
proposing `image.visible.*` Claims; it cannot assert property ownership or create
verified/published values. Image Evidence and runs use a separate Evidence-only
source key; no Candidates are created. Administrator-only previews are served at
`GET /api/admin/research-campaigns/{id}/candidates/{candidateId}/images/{evidenceId}/preview`
after association and checksum checks, with private/no-store headers. Detection,
independent attribution and incremental commercial value remain unmeasured;
see the [visual experiment](../../docs/research/visual-intelligence/README.md).

The bounded reconciliation CLI adds `reconciliation-corpus`, `reconciliation-run`
and `reconciliation-score`. It compares existing proposed Claims with explicit
scope, capacity definitions, validity and evidence-origin rules, storing immutable
Research assessments and Audit history. Identical inputs/reference time/rules
create no duplicate assessment. It does not update Claims, resolve identity or
write Catalog/Curation. The Administrator-only Candidate reconciliation endpoint
and Data Studio show source passages, qualifiers, warnings and rules. Independent
quality evaluation is incomplete; see the
[reconciliation experiment](../../docs/research/reconciliation/README.md).

Two small parsing dependencies support the official register export:
`fflate` (ZIP container of the XLSX workbook) and `saxes` (streaming XML for
its 28 MB worksheet). The OSM PBF format is decoded by an in-repo protobuf
reader (`src/research/acquisition/protobuf-reader.ts`) because the maintained
`pbf` package is ESM-only and this workspace compiles to CommonJS.

## Environment

Validated at boot by `src/config/env.ts` (Zod). Missing or malformed
values fail fast — no silent production defaults. See
[`.env.example`](./.env.example). Copy to `.env.local` for local
development; never commit real values.

For the checked-in Docker Compose database, the example values work as-is.
From the repository root:

```sh
cp apps/api/.env.example apps/api/.env.local
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api dev
```

The API has no startup schema mutation. A fresh database must be migrated
explicitly before administrative requests are usable.

## Endpoints

| Route                                                             | Purpose                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/healthz`                                                | Process liveness; does not touch PostgreSQL.                                         |
| `GET /api/readyz`                                                 | Readiness; confirms PostgreSQL is reachable.                                         |
| `GET /api/me`                                                     | Resolve the configured Administrator membership.                                     |
| `GET /api/admin/research-campaigns`                               | List Research Campaigns, newest first.                                               |
| `POST /api/admin/research-campaigns`                              | Create and audit a Group Rental Property campaign (county optional: national scope). |
| `GET /api/admin/research-campaigns/{id}/acquisition-runs`         | Acquisition Runs with artifact, versions, statistics, and failures.                  |
| `GET /api/admin/research-campaigns/{id}/acquisition-report`       | Data-quality, cross-source, and coverage report.                                     |
| `GET /api/admin/research-campaigns/{id}/candidates`               | Unverified Candidates, filterable and paginated.                                     |
| `GET /api/admin/research-campaigns/{id}/candidates/{candidateId}` | Claims, Evidence, run history, and duplicate suggestions.                            |
| `GET /api/admin/research-campaigns/{id}/duplicate-suggestions`    | Explainable suggestions of the current matcher version.                              |

Every response echoes `X-Correlation-Id`. Administrative routes fail closed
and are guarded through the Access-owned identity resolver. Simulated identity
is accepted only for `local` or infrastructure-protected `private` visibility;
configuration validation refuses it for `public` deployments.

The portable API image is defined by [`Dockerfile`](./Dockerfile). PostgreSQL
migrations remain a separate release/development step rather than mutating the
schema during application startup.
