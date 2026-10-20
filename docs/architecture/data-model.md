# Conceptual data model

## Design rule

Observed data and accepted data are different things. Research produces
source-attributed Claims; verification selects canonical values; publication
makes approved projections available to the Recommendation Product. History is
preserved rather than overwritten.

## Core relationships

```mermaid
erDiagram
    RESEARCH_CAMPAIGN ||--o{ CANDIDATE : discovers
    ACQUISITION_RUN ||--o{ CANDIDATE : produces
    CANDIDATE ||--o{ CLAIM : accumulates
    EVIDENCE ||--o{ CLAIM : supports
    CANDIDATE }o--o| PROVIDER : resolves_to
    CANDIDATE }o--o| OFFER : resolves_to
    PROVIDER ||--o{ OPERATING_LOCATION : has
    PROVIDER ||--|{ OFFER : supplies
    OFFER }o--o{ CATEGORY : classified_as
    CLAIM ||--o{ VERIFICATION_DECISION : evaluated_by
    PROVIDER ||--o{ PUBLICATION : projected_by
    OFFER ||--o{ PUBLICATION : projected_by
```

This is conceptual cardinality. The first physical slice now stores Research
Campaigns, investigated campaign sources, Categories, Administrator membership,
and Audit Events in PostgreSQL. Candidates, Evidence, Claims, and Acquisition
Runs became physical with the acquisition baseline (see below); canonical
catalog records, verification, and publication remain conceptual until their
vertical slices are implemented. Persistent identifiers use application-generated
UUIDv7 values and every table carries `created_at` and `updated_at` timestamps.

## Research side

**Research Campaign** defines a bounded question: geographic area, event need,
category, minimum criteria, and sources.

**Acquisition Run** records one manual import, fetch, extraction, or discovery
attempt. It preserves status, timestamps, inputs, outputs, errors, and cost
metadata so experiments can be evaluated.

**Candidate** is an unresolved possible Provider, Operating Location, or Offer.
It is never public merely because it was discovered.

**Evidence** identifies the material observed by the system or an
Administrator: URL, document, submitted text, partner list, fetch time, content
fingerprint, and—where legally and operationally appropriate—a preserved raw
artifact.

**Claim** is an immutable source-attributed observation such as a phone number,
capacity, price statement, delivery area, or party restriction. A Claim stores
the asserted value, target concept, evidence, observation time, extraction
method, and confidence or review state. Confidence is not truth and does not
publish a Claim automatically.

### Acquisition baseline physical model

The acquisition baseline (`docs/research/group-rental-property-baseline/`)
made the research side physical, all owned by the Research module:

- `source_artifact` — a downloaded file: source, checksum, dataset version
  read from the file, URL, retrieval time, reuse terms, retention policy.
- `acquisition_run` — one import attempt for a campaign: artifact, parser and
  normalizer versions, status (`running`, `succeeded`,
  `completed_with_rejections`, `failed`), statistics, classified failure, and
  an output digest over every Claim and rejection.
- `evidence` — immutable source-record content, unique by source, record key,
  and content checksum, with redacted fields listed (ADR 0023).
- `acquisition_run_record` — how a run interpreted each record (parsed or
  rejected, errors, campaign scope, resulting Candidate).
- `candidate` — campaign-scoped possible Offer, unique by campaign, source,
  and record key; `verification_status` is constrained to `unverified`.
- `claim` — proposed value with target, Evidence locator (source field or
  inference policy), extraction method version, confidence, and observation
  time; `review_status` is constrained to `proposed`. Claim values use an
  exact `jsonb` column so JSON strings are never coerced.
- `duplicate_suggestion` — explainable same-property or same-provider
  suggestion between two Candidates, per matcher version; never a merge.

`research_campaign.county` is nullable: a null county is a national campaign.

## Canonical catalog

**Provider** is the canonical economic actor supplying Offers.

**Operating Location** is a physical place from which a Provider operates. A
venue made available to Users is modeled as an Offer, not merely as an
Operating Location.

**Offer** is the concrete recommendable service, product, package, rental, or
bookable place. One Provider may own multiple Offers.

**Category** supplies controlled classification. Common relational fields
remain explicit columns; genuinely category-specific attributes may use a
versioned definition plus JSONB values and validation. JSONB must not become an
unbounded substitute for modeling known relationships.

## Verification and publication

A **Verification Decision** evaluates one or more Claims for a defined use. It
records the Administrator, time, outcome, and rationale. Selecting a canonical
value references the supporting Claim or the documented derivation.

A **Publication** creates or updates the public projection from approved
canonical values. Published data keeps references to its verification basis and
timestamps. A correction adds Claims and decisions; it does not delete the
history that explained the previous state.

Reverification is triggered by age, changed evidence, contradiction, source
risk, or explicit Administrator action. Freshness policy is defined per field
or Claim type rather than by one global expiration interval.

## Audit and deletion

Sensitive mutations record actor, timestamp, action, target, and relevant before
and after references. Audit events support accountability but do not replace
domain state.

Raw evidence retention and deletion rules remain subject to legal review and
source terms. The model must support deleting or restricting a raw artifact
without corrupting the provenance metadata and decisions that depended on it.
