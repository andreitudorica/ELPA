# Data Studio alpha

## Objective

Validate the manual process required to build a small, trustworthy, locally
dense catalog before automating discovery or extraction at scale.

The alpha succeeds when the team can run one complete Research Campaign from
source discovery through published, explainable data and can identify where
manual effort, uncertainty, and data gaps actually occur.

## Initial users and access

The alpha has one role: **Administrator**. Authentication is simulated only in
local development or an infrastructure-protected private alpha environment.
Every sensitive action still receives an actor and timestamp so later OIDC
integration does not require redesigning the domain workflow.

## In scope

1. Create and track a Research Campaign.
2. Add a Candidate manually or import a URL.
3. Record Evidence and Claims without writing directly to canonical records.
4. Review extracted or manually entered Claims.
5. Search for possible duplicates and resolve a Candidate to a canonical
   Provider or Offer.
6. Create and maintain Providers, Operating Locations, Offers, and Categories.
7. Verify Claims and select canonical values with rationale.
8. Publish approved projections for API consumption.
9. Flag stale or contradictory data for reverification.
10. Inspect actor-attributed audit history.
11. Measure coverage and data quality for the chosen campaign.

## Explicitly out of scope

- Exhaustive national coverage.
- Autonomous publication by AI or scrapers.
- Live availability guarantees or booking transactions.
- Provider self-service onboarding.
- Fine-grained Data Studio roles beyond Administrator.
- Production OIDC authentication during the protected alpha.
- A general-purpose workflow builder.
- A permanent scraping platform before experiments justify it.

## Suggested first vertical slice

Use one category and one geographic campaign. Implement the complete path:

```text
Research Campaign
  -> manual Candidate
  -> Evidence and Claims
  -> duplicate review
  -> canonical Provider and Offer
  -> Verification Decision
  -> Publication
  -> public read through the generated API client
```

This tracer bullet proves the API, database model, OpenAPI generation, both
trust boundaries, and the curation-to-publication separation before breadth is
added.

## Alpha outcomes

The team should leave the alpha with evidence for:

- the fields common to all Offers versus category-specific attributes;
- the minimum publishable Claim set;
- review time per Provider and Offer;
- duplicate frequency and useful matching signals;
- field-specific freshness expectations;
- coverage gaps for the initial use case and geography;
- which acquisition steps merit automation.

## First vertical slice — Group Rental Property (Romania)

The POC vertical is **Group Rental Property** (see `UBIQUITOUS_LANGUAGE.md`).
The following decisions were crystallised during design and are the working
definitions the alpha will exercise; they may be revised as evidence
accumulates.

### Minimum publishable Claim set for a Group Rental Property Offer

**Tier 1 — hard gate.** Publication is refused if any of these Claims is
missing or unverified:

- `name`
- `provider_id` (with the linked Provider verified: name + at least one
  contact channel)
- `primary_locality` (județ + localitate)
- `coordinates` (town-level precision or better)
- `property_type` (Layer-2 enum: `cabana` | `casa_de_vacanta` | `vila` |
  `complex` | `cottage` | `other`)
- `sleeps_persons`
- `parties_allowed` (`yes` | `no` | `by_arrangement`) — inferred from source
  policy when the listing is silent, with rationale attached
- `primary_contact_channel` + one usable contact detail (or a working
  booking URL)
- `primary_photo_url`
- `pricing_summary` (freeform display string, verbatim from source when
  possible; `pricing_currency` defaults to `RON`) OR a structured
  `price_low` together with `pricing_currency`
- ≥ 1 verified **Evidence** source (already required by the Claim model)

**Tier 2 — soft gate.** Publication permitted; a `completeness_score`
drops and Administrators see a "thin data" flag:

- Rest of property shape (`bedrooms_count`, `beds_count`, `bathrooms_count`,
  `max_daytime_guests`)
- Event-hosting policy beyond `parties_allowed` (`quiet_hours_start`,
  `quiet_hours_end`, `pets_allowed`, `children_allowed`, `smoking_allowed`,
  `music_policy`)
- Structured pricing (`pricing_model`, `price_low`, `price_high`,
  `weekend_package_price`, `min_nights_for_price`, `pricing_notes`) when
  Tier 1 used only the freeform summary. All monetary values are stored in
  the source's `pricing_currency`; conversion to a display currency happens
  at query time and never overwrites the Claim.
- Amenities used in stepper must-haves (`outdoor_grill`,
  `outdoor_covered_area`, `pool`, `sauna`, `hot_tub`, `indoor_fireplace`,
  `kitchen_type`)
- `setting_tags[]`
- `min_nights`, `weekend_only`

**Tier 3 — enrichment.** Absence has no gate effect:

- Practical constraints (`road_access`, `winter_accessible`, `power_source`,
  `has_backup_generator`, `heating_type`, `internet_type`,
  `mobile_signal_quality`, `distance_to_nearest_shop_km`, `parking_spaces`,
  `wheelchair_accessible`)
- Stay logistics (`check_in_earliest`, `check_out_latest`,
  `payment_methods[]`)
- Ancillary fees (`deposit`, `cleaning_fee`, `firewood_fee`, `linen_fee`,
  all in `pricing_currency`) and `pricing_includes_vat` (`yes` | `no` |
  `unknown`, default `unknown`)
- Media beyond `primary_photo_url`
- `languages_spoken[]`, `dishware_for_persons`
- Distance features (`ski_slope_distance_km`, `water_body_distance_km`)

### Freshness policy (Group Rental Property)

Per `docs/architecture/data-model.md` (freshness per-field, not global):

- **Static-ish (12-month reverification):** `property_type`, `coordinates`,
  `sleeps_persons`, `bedrooms_count`, and other structural amenities
  (fireplace, pool, sauna, kitchen presence).
- **Semi-static (6-month reverification):** rules and policies
  (`parties_allowed`, `pets_allowed`, `quiet_hours_*`, `min_nights`,
  `weekend_only`, `road_access`, `power_source`), `setting_tags[]`.
- **Volatile (30-day reverification, or on-demand when the Offer appears in
  a top-N shortlist):** `pricing_summary` and structured pricing,
  `primary_contact_channel` + contact details, `primary_photo_url`.

On-demand refresh for shortlisted Offers is out of POC scope but retained
here as a known design direction: it affects duplicate detection and the
LLM-agent's job.
