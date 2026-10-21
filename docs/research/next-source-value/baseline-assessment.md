# Observed baseline assessment

The assessment uses the running PostgreSQL database, the existing Research CLI,
the [aggregate snapshot](./data/baseline-observed.json), and a fresh reproduction
inside an isolated campaign. It does not treat the previous task's plan as proof.

## What works

- Register and OSM artifacts are pinned by SHA-256; parsing produces the same
  output digests as the original report.
- Research owns acquisition, redacted per-record Evidence, proposed Claims,
  Candidates, and duplicate suggestions. Batch writes use the existing unit of
  work. No new queue, service, authoritative store, or extraction vendor is used.
- The national baseline contains 42,861 source-keyed Candidate records and
  468,223 Claims: 32,216 register Candidates / 397,491 Claims and 10,645 OSM
  Candidates / 70,732 Claims. These are not unique-property counts.
- SQL inspection found zero non-`unverified` Candidates and zero non-`proposed`
  Claims. The corresponding CHECK constraints remain intact.
- The unchanged matcher reproduced 465,426 compared pairs and 11,666 suggestions:
  3,181 likely and 7,764 possible same-property suggestions, and 721 same-provider
  suggestions. Suggestions never merge anything.
- Existing Administrator-guarded endpoints serve runs, Candidate detail with
  Evidence/Claims, source filters, suggestions, and aggregate quality reports.

## Measured coverage and completeness

| Measure                  |           Register |    OSM |
| ------------------------ | -----------------: | -----: |
| Source records read      |             32,231 | 10,645 |
| Rejected                 | 15, unknown county |      0 |
| Candidates               |             32,216 | 10,645 |
| Screened plausible       |              3,929 |  1,495 |
| Screened ambiguous       |             11,368 |  3,781 |
| Screened out of scope    |             16,919 |  5,369 |
| Name completeness        |               100% | 89.99% |
| Coordinates              |                 0% |   100% |
| Address                  |             92.46% | 40.08% |
| Overnight capacity Claim |             99.89% |     0% |
| Website                  |              9.55% | 18.96% |

The snapshot carries all reported fields and the 42-county reference breakdown.
Among the 15,297 plausible/ambiguous register records, OSM reconciles at the
likely tier with 1,464 (9.57%), and at either tier with 3,571 (23.34%). These
are matcher outcomes against a defined source subset, not national market shares.
Examples motivating the county strata: likely reconciliation is 4.25% in Bihor,
6.06% in Maramureș, 6.82% in Constanța, 16.25% in Brașov, 11.13% in Cluj, and
12.11% in Harghita. The full county denominators are in the JSON.

The connected-component estimate is 34,360–39,850 distinct properties among
**all** 42,861 records, including out-of-scope accommodation. It is an unverified
matcher estimate, not a confidence interval or an estimate of eligible properties.
Distinct eligible properties remain unknown. Neither source establishes exclusive
rental or private-event permission; structural capacity is not event capacity.

## What remains partial

- Independent entity-resolution accuracy is **not measured**. The previous
  352-item review sample exists, but no independently completed labels were
  supplied; precision, recall, false-merge rate, and eligibility precision are
  unknown. Existing evaluation code and review files are infrastructure for
  measurement, not measured accuracy.
- Before this change, the acquisition/matching slice had no automated tests.
  Direct baseline runs passed 4 API tests and 10 web tests, but the API tests
  covered only error mapping. This experiment adds focused acquisition,
  sampling, comparison, and review-scoring tests.
- API integration/contract test infrastructure is still absent. Unit tests and
  successful real local runs do not replace a database integration suite.
- Live inspection exposed an existing read-model defect: Candidate-list
  suggestion counts show zero even when Candidate detail and persisted
  suggestions contain links. Use detail and aggregate reports for review;
  this list-count defect remains unresolved and does not feed the experiment's
  overlap calculations.
- Curation and Recommendation modules are empty. Canonical Offers, verification,
  publication, and public recommendation results are not implemented.
- Whole-dataset output digests do not by themselves prove correct campaign
  scoping; this experiment also checks campaign-specific counts.
- OSM/register public-use and privacy/licensing boundaries remain unresolved for
  production; the earlier memo's broad assertion about derivative databases is
  not a legal determination for every possible combination.

The experiment leaves the original national campaign unchanged and reproduces
its two artifacts in a separate national Research Campaign. This provides a
stable before/after denominator without counting the earlier Cluj test campaign
as additional national supply.
