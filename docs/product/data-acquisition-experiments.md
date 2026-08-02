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
