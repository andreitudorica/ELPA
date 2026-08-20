# Data acquisition experiments

## Why this is experimental

“Scraping” hides several different problems: discovery, fetching, rendering,
document parsing, extraction, normalization, duplicate detection, change
detection, legal permission, and operational maintenance. ELPA will not design a
general scraping platform before learning which of those problems matter for
the first campaign.

## Invariants

- Automation proposes Candidates and Claims; it never publishes canonical data.
- Every Claim retains source, observation time, and extraction method.
- Fetching and extraction are separate stages so either can be replaced.
- Where permitted, raw fetched evidence is preserved before extraction.
- Failures are durable, inspectable results rather than lost logs.
- Source terms, robots directives, personal-data constraints, and retention
  rules are reviewed before recurring automation.
- Credentials and authenticated source access are never embedded in scrapers or
  committed fixtures.

## Experiment ladder

### 0. Manual baseline

Administrators enter Candidates, Evidence, and Claims manually. Measure the
time and judgment required; this is the baseline automation must beat.

### 1. URL import and static fetch

Given an Administrator-provided URL, fetch accessible content, preserve source
metadata and an allowed artifact, and let the Administrator create Claims from
it. Do not add browser automation yet.

### 2. Assisted extraction

Extract proposed Claims from fetched text or documents. Show the exact evidence
supporting each proposal and require human acceptance. Evaluate deterministic
parsers and model-assisted extraction against the same labeled examples.

### 3. Duplicate suggestions

Suggest possible canonical matches using normalized name, phone, email, domain,
address, social profiles, and Offer similarity. An Administrator resolves the
match.

### 4. Assisted discovery

Use search or source-specific discovery to propose Candidate URLs for one
campaign. Keep discovery results distinct from verified Providers.

### 5. Dedicated source adapter

Build a recurring adapter only when a source repeatedly supplies valuable data,
its use is permitted, its structure is stable enough, and measured maintenance
cost is acceptable.

### 6. Change detection

Re-fetch selected evidence and detect meaningful changes only after publication
and freshness policies exist. A detected change creates new Claims and a
reverification task; it never overwrites canonical data.

## Extractor output contract

Every acquisition extractor — deterministic parser or LLM-driven agent —
returns the same envelope. The shape isolates provenance so extractor
versions can evolve independently of the schema and so a broken parse never
corrupts the source string.

```jsonc
{
  "candidate": {
    "kind": "group_rental_property",           // Category the Candidate targets
    "source_url": "...",
    "artifact_ref": "...",                     // pointer to preserved raw evidence
    "fetched_at": "...",
    "acquisition_run_id": "...",
    "extractor_version": "llm_gpt5_v0.1"       // versioned per extractor
  },
  "provider_hint": {                           // never a resolved Provider; ADR 0013 invariant
    "name": "...",
    "contact_hints": { ... },
    "provider_kind_hint": "individual" | "sole_trader_pfa" | "company_srl" | "..."
  },
  "claims": [
    {
      "target": "offer.<field>",               // one Claim per target field
      "value": <field-typed>,
      "evidence": {                            // discriminated union
        "type": "text_span"       ,            // + quote + location tag
             | "image_annotation" ,            // + image ref + caption/region
             | "structured_field" ,            // + JSON-LD / schema.org pointer
             | "inferred"         ,            // + rationale + policy_id
        ...
      },
      "extraction_method": "llm_gpt5_v0.1" | "regex_price_v1" | "rule_source_policy_v1" | "...",
      "confidence": 0.0..1.0                   // always required; float, not enum
    }
    // ... one Claim per target field; multiple Claims MAY target the same
    // field if extractors disagree — verification picks the canonical value
  ]
}
```

Rules that follow from this shape:

- **One Claim per target field, one Evidence per Claim.** Per-field
  confidence and per-field freshness are already required (see the
  Group Rental Property tiers in `data-studio-alpha.md`); atomic Claims are
  what make them native rather than bolt-on.
- **Evidence is a discriminated union**, not a free blob. Verification UIs
  render each variant differently: `text_span` shows the verbatim quote;
  `inferred` shows the rationale and cited policy so the Administrator sees
  _why_ the value was proposed.
- **`inferred` Claims are Claims proper.** A rule such as "silent listing
  on a direct-owner site → `parties_allowed = by_arrangement`" produces a
  low-confidence `inferred` Claim citing a versioned `policy_id`. It is
  still verified, still auditable, still overridable.
- **The extractor never returns canonical values.** It returns Claims. The
  Verification Decision selects canonical values, per ADR 0013.
- **Multiple extractors may target the same field.** Two Claims for the
  same target are the normal shape whenever a freeform Claim
  (`pricing_summary`) is accompanied by a parsed structured Claim
  (`price_low`, `pricing_currency`) — the freeform Claim survives even
  when the parser is wrong.
- **The contract is TypeScript-first.** A Zod schema at the boundary is
  the source of truth; the API DTOs (NestJS) and the generated client
  types (ADR 0012) are derived from it. Malformed extractor outputs are
  rejected before they touch the database.

## Technical boundary

Each run has a durable record in PostgreSQL with:

- campaign and source;
- input and normalized URL;
- acquisition stage and implementation version;
- start, completion, and retry timestamps;
- status and classified failure;
- artifact reference and content fingerprint;
- proposed Candidate and Claim identifiers;
- human review outcome;
- elapsed time and external cost.

The fetcher, renderer, document parser, extractor, and discovery mechanism are
replaceable adapters behind application-owned ports. Queue and worker technology
is deliberately deferred until experiments reveal duration, concurrency, retry,
and scheduling needs.

## Evaluation dataset

Create a small versioned set of legally retained pages or documents plus
Administrator-approved expected Claims. Do not make live websites the only test
fixture. For every experiment record:

- field-level precision and recall where a labeled set exists;
- unsupported or hallucinated Claim rate;
- percentage of Claims with precise evidence spans;
- Administrator review time;
- fetch and parse failure rate;
- duplicate suggestion acceptance rate;
- cost per accepted Provider or Offer;
- breakage after representative source changes.

## Promotion rule

An experiment becomes supported product behavior only when it reduces total
curation effort without lowering provenance or verification quality, has an
identified owner, includes observable failure handling, and has a documented
legal and operational posture.
