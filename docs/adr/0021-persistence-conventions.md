# Persistence conventions: keys, enums, JSONB, transactions

`apps/api` speaks to Postgres (ADR 0005) through Drizzle (ADR 0006) with
the following conventions, applied uniformly across all modules.

## Storage shape

- **All tables in the `public` Postgres schema, unprefixed.** The
  code-level module boundary (ADR 0020) is the boundary; DB-level schema
  isolation adds cross-schema-join friction without security benefit for
  a single-application deployment.
- **Primary keys are `uuid v7`,** generated in the application layer.
  Time-ordered (index-friendly like `bigserial`), globally unique
  (no coordination if a module is later extracted), safe to expose in
  URLs. Postgres stores them natively as `uuid`.
- **Every table carries `timestamptz` `created_at` and `updated_at`** via
  a shared column helper. `deleted_at` is added only where soft-delete
  is a modelled requirement, not by default.
- **Domain vocabularies are `text` columns with `CHECK` constraints,
  never PostgreSQL `ENUM` types.** Adding, renaming, or retiring a value
  is a normal migration; PG enum `ALTER` is painful and vocabulary is
  expected to evolve during the alpha (see the tiered `Group Rental
Property` schema in `data-studio-alpha.md`).
- **Layer-2 category-specific attributes are stored as JSONB with a
  paired schema-version column per Category** (e.g.
  `offer.group_rental_property_attrs` + `..._version`). No shared
  wildcard "attributes" bag across Categories; each Category evolves its
  own schema independently. A **versioned Zod schema per Category** is
  the source of truth for validation and runs at every
  application-service ingress.

## Migrations

- **`drizzle-kit generate`** produces SQL migrations committed to git,
  timestamp-prefixed. `drizzle-kit push` is banned outside scratch
  contexts because it desyncs prod from git.
- **Migrations run out-of-process, never on API boot.** A
  `pnpm --filter @elpa/api db:migrate` CLI is invoked by dev scripts and
  CI/deploy pipelines. Boot-time migration in multi-instance deployments
  races with itself and turns rollback into a code deploy.

## Transactions

- **Transactions are propagated via AsyncLocalStorage-backed unit of
  work.** A `@Transactional()` decorator (or `runInTransaction(cb)`
  helper) opens/commits/rolls-back around a service method; repositories
  read a request-scoped CLS store for a live transaction and fall back
  to the base connection otherwise. **No `tx` parameter is passed
  through service or repository signatures.**
- **Why not per-signature `tx`:** it leaks the ORM into every method
  signature, every test double, every cross-service call — correctness
  by memory. CLS is one hidden abstraction that removes the leak
  permanently. This is the "fix from core" version.
- **The same CLS store carries the correlation ID** used by the logger
  (see the `apps/api` README). One CLS store, multiple concerns — no
  parallel context stacks.

## Consequences

- Adding a new Category is (a) declare its Layer-2 Zod schema + add the
  paired JSONB columns to `offer`, (b) ship its stepper tail, (c) ship
  its extractor. No touching of Layer 1 relational schema or of any
  other Category.
- Contributors need to know CLS is in play. Documented once; the
  `@Transactional()` decorator and the `withRollingBackTransaction()`
  test helper are the only entry points.
- Rollback in production is via forward-fix migrations plus point-in-time
  restore of the managed database (ADR 0011). `drizzle-kit` has no down
  migrations by design; do not fight this.
- `uuid v7` keys are 16 bytes vs. `bigserial`'s 8. Immaterial at alpha
  scale; if a specific hot table ever becomes IO-bound, migrating that
  one table to `bigserial` + a secondary `uuid` is a local change, not
  a global one.
