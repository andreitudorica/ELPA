# Three-layer ontology: common Offer columns, Category-specific attributes, Event Brief

Data about a recommendable **Offer** and data about a **User**'s intent
are separated across three layers, each with a different storage strategy
and a different rate of change.

- **Layer 1 — common Offer columns.** Fields every Offer has regardless of
  **Category**: name, description, Provider, geographic location, media,
  primary contact channel, external URLs, pricing summary, publication
  metadata. Explicit relational columns.
- **Layer 2 — Category-specific Offer attributes.** Fields meaningful only
  within one Category. Stored as JSONB values against a **versioned schema
  definition** (per ADR 0006 / `data-model.md`) so validation is real and
  API DTOs can be derived per Category. JSONB is schema-flexible; it is
  never schema-less.
- **Layer 3 — Event Brief.** The User's Event context (event type, guest
  counts, dates, region, must-haves, vibe, budget). Lives on the User's
  session, **never on an Offer**. The recommendation engine and AI helper
  reason over `Event Brief × Offer(Layer 1 + Layer 2)` to filter, rank,
  and surface unmet needs.

## Why

- Sources publish Offer-shaped data. Stepper answers are User-shaped.
  Collapsing them into one shape forces phantom fields like
  `suitable_for_baby_shower` that no source publishes and no
  Administrator can honestly verify.
- Every new Category has genuinely different attributes (a caterer has
  cuisines and dietary options; a cabin has capacity and party rules).
  Layer 2 lets Categories evolve at their own pace without touching the
  relational schema for every experiment.
- Rule-based "have you thought about…" prompts become a pure function of
  Layer 3 and Layer 2 attributes — deterministic and testable, no LLM
  needed for the base experience.
- Extraction and verification target Layers 1 and 2 only. Layer 3 has
  nothing to acquire — it is generated fresh per User session.

## Consequences

- The catalog schema has a stable relational core (Layer 1) plus a
  Category-versioned JSONB surface (Layer 2). When a Layer-2 attribute
  turns out to be shared across ≥ 50 % of Categories, it is promoted into
  Layer 1 — this is the intended evolution path, not a regression.
- The Event Brief needs its own persistence and API surface — small, but
  distinct from the catalog. It is deliberately a Recommendation
  Product-side concept.
- The three-layer split is the seam along which the stepper (universal
  head + Category-specific tails) is organised; a new Category is added
  by (a) declaring its Layer-2 schema, (b) shipping its stepper tail,
  (c) shipping its extractor. No changes to Layer 1 or Layer 3
  scaffolding.
- Extractors return Claims targeting Layer 1 or Layer 2 fields
  (`offer.name`, `offer.<category-attribute>`) — never Layer 3. This
  keeps the automation-proposes-canonical-decides invariant of ADR 0013
  intact across every extractor version.
