# API modular-monolith module shape

`apps/api` is organised as one NestJS+Fastify application whose top-level
folders match the bounded contexts of the domain (Access, Research,
Catalog, Curation, Recommendation, Audit — as listed in
`docs/architecture/system-overview.md`). Each module is internally split
into `controller → application service → repository → drizzle schema` plus
per-projection DTOs, and **exposes a single public surface via a barrel
`index.ts`**. Cross-module code paths import only from the barrel; the
constraint is enforced statically by an ESLint `no-restricted-imports`
rule and dynamically by a boot-time route verifier that refuses to start
the app if module conventions are violated.

## Why

- **Faithful to ADR 0001.** A "modular monolith" whose modules cannot
  actually be extracted later is a monolith with folders. A public barrel
  per module and a hard rule against reaching past it is what makes the
  boundary real.
- **Chose over the alternatives** — default NestJS layout (modules but no
  enforced surface) gives up the "modular"; full hexagonal / DDD triple
  folders per module (`domain/`, `application/`, `infrastructure/`)
  imposes ceremony on modules that do not yet have domain logic worth
  protecting. The middle path here is smaller than hexagonal and stricter
  than default Nest.
- **The six module boundaries already exist** in `system-overview.md`;
  making them literal NestJS module boundaries has no design cost.
- **The boundary check runs at boot, not at review.** A route under
  `/api/admin/*` without `AdministratorGuard`, or a route with the guard
  outside that prefix, causes the app to fail to start. This is the
  intended "fix from core" property: forgetting the decorator is a boot
  failure, not a security incident that reviewers must catch.

## Consequences

- Cross-module reads always go through a typed service call on the target
  module's public surface. N+1 patterns are prevented at the seam by
  requiring batch methods (`getProvidersByIds(ids)`) rather than
  per-entity accessors.
- A module can internally adopt CQRS or full hexagonal without changing
  its public surface. The barrier is the seam along which any future
  service extraction happens.
- Drizzle schemas live inside their owning module; a thin
  `apps/api/src/drizzle/schema.ts` re-exports them **only for
  drizzle-kit** — application code never imports from that path.
- Per-projection DTOs (canonical `Offer` vs `PublishedOffer`, etc., per
  ADR 0012) are separate files inside the owning module. ESLint enforces
  that public routes never reference admin schemas.
- Contributors familiar with Nest CLI tutorials need to know the shape
  differs from the type-based split (`controllers/`, `services/`,
  `entities/`). Documented once in `apps/api/README.md`.
