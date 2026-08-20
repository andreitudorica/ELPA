# Events are composed of independent Offers

An "event" a User is organising (a birthday, a baby shower, a weekend with
friends) is not a first-class entity in the domain. It is expressed as an
**Event Brief** on the User's session, which the recommendation engine
matches against a set of independent **Offers**, potentially supplied by
different **Providers** across different **Categories** (a cabin rental,
catering, an ice bar, kids' entertainment). The User composes the plan by
selecting Offers; ELPA does not model, price, or persist a bundled
"event package" as a catalog entity.

## Why

- Sources describe the world Offer-by-Offer (a cabin listing, a caterer's
  menu, an entertainer's booking page). Modelling events as first-class
  packages would force us to synthesise a concept the supply side never
  publishes, and would fight the extraction pipeline instead of
  cooperating with it.
- Every supply Category can evolve independently — its own attributes,
  freshness cadence, extraction schema, verification workflow — without
  touching a global "event package" schema.
- The "have you thought about a backup generator?" experience is a pure
  function of `Event Brief × Offers-so-far`. It does not need a persisted
  package to exist.
- Composition at recommendation time preserves optionality: a User can
  swap the caterer without invalidating the cabin choice, and the Provider
  contracts remain point-to-point rather than mediated by ELPA.

## Consequences

- There is no `Event` table in the catalog. If we later need one — for
  saved plans, sharing, or B2B RFQ workflows — it is a Recommendation
  Product-side concept, not a catalog-side one, and it composes existing
  Offer identifiers rather than replacing them.
- Bundled pricing (a discount for choosing cabin + catering from
  cooperating Providers) is not part of the initial model. When it lands
  it will be a Recommendation Product feature over independent Offers,
  not a new Offer subtype.
- Cross-Category recommendation quality is bounded by how well the
  Event Brief captures cross-supplier constraints (dates that must match
  across cabin + caterer + transport). This is an accepted design cost
  of the composition model.
