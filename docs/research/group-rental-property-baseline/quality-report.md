# Data-quality and cross-source report (baseline)

Generated from stored records by `pnpm --filter @elpa/api research report`
(report version `grp-acquisition-report@1`); the full machine-readable output is
[`data/acquisition-report.json`](./data/acquisition-report.json). The same
report is served to Data Studio at
`GET /api/admin/research-campaigns/{id}/acquisition-report`.

Inputs: register export of **2026-10-21** (two byte-different downloads),
OpenStreetMap Romania at **2026-10-19T20:21:11Z**, normalizers `@1`, screening
rubric `grp-population-screening@1`, matcher `grp-duplicate-matcher@1`,
national Research Campaign "Bază de referință achiziție — proprietăți pentru grupuri (România)".

## How to read the figures

- **Observed** — counted directly from stored records, Evidence, Claims, and
  suggestions.
- **Estimate** — derived from unverified matcher suggestions; given as a range.
- **Not verified** — no Candidate has passed Verification. No figure below is a
  verified property count, and screening classes are automated hints, not
  review decisions.
- **Not measured** — matching accuracy and relevance rates need the
  independent review in the [evaluation protocol](./evaluation-protocol.md).

## 1. Ingestion reliability (observed)

|                                               |                                                                     Register |                                                                        OpenStreetMap |
| --------------------------------------------- | ---------------------------------------------------------------------------: | -----------------------------------------------------------------------------------: |
| Source records read                           |                                                                       32,231 |                                                                               10,645 |
| Parsed                                        |                                                                       32,216 |                                                                               10,645 |
| Rejected (invalid)                            |                                          15 (`unknown_county`: empty county) |                                                                                    0 |
| Excluded by source scope                      |                                                                            — | 354 (`outside_romania` 170, `wilderness_hut` 84, `camp_pitch` 80, `caravan_site` 20) |
| Records without a stable identifier           | 16 without a certificate number; 6 derived-key collisions resolved with `#n` |                                                                       0 (native ids) |
| Without settlement                            |                                                                           48 |                                                                                  331 |
| Without coordinates                           |                                               32,216 (the register has none) |                                                                                    0 |
| Runs                                          |                               3 × `completed_with_rejections` on 2 artifacts |                                                                      1 × `succeeded` |
| Distinct output digests for the same versions |                                                          **1** (`db591e6e…`) |                                                                  **1** (`2e431043…`) |
| Repeat import of identical content            |           0 new Evidence, 0 new Candidates, 0 new Claims (397,491 unchanged) |                                                                                    — |
| Duration                                      |                                      46 s first import; 33 s for each repeat |                                                      39 s (three passes over 331 MB) |

A run that rejects records is reported as `completed_with_rejections`, never as
`succeeded`. More than 2 % rejected records fails the run without writing any
Evidence, Candidates, or Claims.

## 2. Field completeness (observed, share of Candidates with a current Claim)

| Field (Claim target)            | Register | OpenStreetMap |
| ------------------------------- | -------- | ------------- |
| `offer.name`                    | 100.0 %  | 90.0 %        |
| `offer.primary_locality`        | 100.0 %  | 100.0 %       |
| `offer.coordinates`             | 0.0 %    | 100.0 %       |
| `offer.address`                 | 92.5 %   | 40.1 %        |
| `offer.sleeps_persons`          | 99.9 %   | 0.0 %         |
| `offer.units_count`             | 99.9 %   | 0.0 %         |
| `offer.rooms_count`             | 0.0 %    | 5.1 %         |
| `offer.beds_count`              | 0.0 %    | 0.7 %         |
| `offer.capacity_persons`        | 0.0 %    | 0.3 %         |
| `offer.registry_classification` | 100.0 %  | 0.0 %         |
| `offer.registry_certificate`    | 100.0 %  | 0.0 %         |
| `offer.website`                 | 9.6 %    | 19.0 %        |
| `offer.business_email_domain`   | 12.8 %   | 5.2 %         |
| `provider_hint.legal_name`      | 74.2 %   | 0.0 %         |
| `provider_hint.tax_id`          | 72.7 %   | 0.1 %         |
| `provider_hint.operator`        | 0.0 %    | 2.9 %         |

## 3. Automated screening (observed counts of rubric-v1 classes, not relevance)

| Class             | Register | OpenStreetMap |
| ----------------- | -------: | ------------: |
| plausible         |    3,929 |         1,495 |
| ambiguous         |   11,368 |         3,781 |
| out_of_scope      |   16,919 |         5,369 |
| insufficient_data |        0 |             0 |

Relevant and irrelevant shares **within a reviewed sample are not available**:
the 65-item eligibility sample has not been reviewed.

## 4. Cross-source value

Observed suggestion counts (grp-duplicate-matcher@1, 465,426 pairs compared):

| Source pair       | Relation      | Strength | Rule                                  | Count |
| ----------------- | ------------- | -------- | ------------------------------------- | ----: |
| OSM–register      | same_property | possible | `exact_core_name_with_caveats`        | 2,944 |
| OSM–register      | same_property | possible | `similar_name_same_settlement`        | 2,074 |
| OSM–register      | same_property | likely   | `exact_core_name_same_settlement`     | 1,957 |
| register–register | same_property | possible | `same_name_same_settlement`           | 1,483 |
| register–register | same_property | likely   | `same_name_address_capacity`          |   481 |
| OSM–register      | same_property | likely   | `address_match_similar_name`          |   425 |
| OSM–OSM           | same_property | possible | `exact_core_name_with_caveats`        |   403 |
| OSM–OSM           | same_property | possible | `similar_name_same_settlement`        |   344 |
| OSM–register      | same_property | possible | `exact_core_name_same_settlement`     |   255 |
| OSM–register      | same_provider | possible | `shared_website_domain`               |   227 |
| OSM–OSM           | same_provider | possible | `shared_website_domain`               |   211 |
| register–register | same_property | possible | `near_identical_name_same_settlement` |   191 |
| OSM–OSM           | same_property | likely   | `exact_core_name_same_settlement`     |   173 |
| OSM–register      | same_provider | possible | `shared_email_domain`                 |   147 |
| OSM–register      | same_provider | possible | `shared_listing_page`                 |   101 |
| register–register | same_property | likely   | `same_certificate_and_name`           |    94 |
| OSM–register      | same_property | possible | `address_match_similar_name`          |    68 |
| OSM–OSM           | same_property | likely   | `address_match_similar_name`          |    48 |
| OSM–OSM           | same_provider | possible | `shared_listing_page`                 |    15 |
| OSM–OSM           | same_provider | possible | `shared_email_domain`                 |    10 |
| OSM–register      | same_provider | likely   | `shared_tax_id`                       |     9 |
| OSM–register      | same_property | likely   | `same_listing_page`                   |     2 |
| OSM–register      | same_property | possible | `same_listing_page`                   |     2 |
| OSM–OSM           | same_provider | likely   | `shared_tax_id`                       |     1 |
| OSM–OSM           | same_property | likely   | `same_listing_page`                   |     1 |

| Measure                                                       |                                        Value | Label                |
| ------------------------------------------------------------- | -------------------------------------------: | -------------------- |
| Register Candidates with an OSM counterpart, `likely`         |                              2,384 of 32,216 | observed, unverified |
| … with any suggestion                                         |                                        6,429 | observed, unverified |
| OSM Candidates with a register counterpart, `likely`          |                              2,384 of 10,645 | observed, unverified |
| … with any suggestion                                         |                                        5,227 | observed, unverified |
| Register Candidates with no cross-source suggestion           |                                       25,787 | observed             |
| OSM Candidates with no cross-source suggestion                |                                        5,418 | observed             |
| Candidates whose suggestions are all `possible` (need review) |                                        8,278 | observed             |
| Distinct properties among 42,861 Candidates                   |                          **34,360 – 39,850** | estimate             |
| Plausible/ambiguous Candidates only in the register           |                                       11,726 | observed, unverified |
| Plausible/ambiguous Candidates only in OSM                    |                                    **2,705** | observed, unverified |
| Plausible/ambiguous register Candidates also suggested in OSM |                                        3,571 | observed, unverified |
| Register operators (tax ids) with several certificates        | 2,870 covering 8,494 Candidates; largest 156 | observed             |

Every `likely` cross-source counterpart is one-to-one (2,384 on each
side) because of the ambiguity rule. The distinct-property range uses connected
components of same-property suggestions: likely-only merges least (upper
bound), likely plus possible merges most (lower bound).

Broad identifiers excluded as Provider evidence (more than 50 Candidates each):
four property-manager email domains and four register tax ids.

## 5. Entity-resolution quality

**Not measured.** Precision, recall, F1, false-positive and false-negative
rates, false-merge and missed-duplicate examples, and confidence intervals will
be computed by `research evaluation-score` once two independent reviewers and
an adjudicator have labelled the 352-item sample. Automatic (`likely`) and
review (`possible`) tiers will be reported separately.

## 6. Coverage against a defined reference population

Reference population: Current official-register Candidates in campaign scope screened plausible or ambiguous by rubric v1 (automated screening, not verified eligibility). Size **15,297**.

|                                             | Count |  Share |
| ------------------------------------------- | ----: | -----: |
| Reconciled with an OSM `likely` counterpart | 1,464 |  9.6 % |
| Reconciled with any OSM suggestion          | 3,571 | 23.3 % |

This is the share of a defined official-register subset that OpenStreetMap can be reconciled with, under unverified suggestions. It is not the share of all Romanian group-rental properties: unregistered properties and the true eligible population are unknown.

By county (observed, unverified):

| County          | Reference population | Reconciled (likely) | Reconciled (any suggestion) |
| --------------- | -------------------: | ------------------: | --------------------------: |
| Constanța       |                2,258 |         154 (6.8 %) |                637 (28.2 %) |
| Brașov          |                1,452 |        236 (16.3 %) |                560 (38.6 %) |
| Suceava         |                1,032 |          74 (7.2 %) |                206 (20.0 %) |
| Maramureș       |                  907 |          55 (6.1 %) |                136 (15.0 %) |
| Harghita        |                  669 |         81 (12.1 %) |                135 (20.2 %) |
| Tulcea          |                  634 |         64 (10.1 %) |                145 (22.9 %) |
| Cluj            |                  629 |         70 (11.1 %) |                129 (20.5 %) |
| Prahova         |                  628 |         87 (13.9 %) |                184 (29.3 %) |
| Sibiu           |                  625 |          56 (9.0 %) |                138 (22.1 %) |
| Bihor           |                  541 |          23 (4.3 %) |                 79 (14.6 %) |
| Hunedoara       |                  520 |          34 (6.5 %) |                101 (19.4 %) |
| Alba            |                  484 |         62 (12.8 %) |                139 (28.7 %) |
| Argeș           |                  468 |          36 (7.7 %) |                 95 (20.3 %) |
| Vâlcea          |                  428 |         47 (11.0 %) |                107 (25.0 %) |
| Neamț           |                  424 |         45 (10.6 %) |                 93 (21.9 %) |
| Mureș           |                  406 |         73 (18.0 %) |                119 (29.3 %) |
| Gorj            |                  395 |          23 (5.8 %) |                 47 (11.9 %) |
| Caraș-Severin   |                  335 |         39 (11.6 %) |                 71 (21.2 %) |
| Mehedinți       |                  282 |         41 (14.5 %) |                 72 (25.5 %) |
| Bistrița-Năsăud |                  218 |          15 (6.9 %) |                 35 (16.1 %) |
| Bacău           |                  199 |         20 (10.1 %) |                 46 (23.1 %) |
| Timiș           |                  184 |         22 (12.0 %) |                 46 (25.0 %) |
| Covasna         |                  182 |          11 (6.0 %) |                 19 (10.4 %) |
| Arad            |                  151 |         18 (11.9 %) |                 40 (26.5 %) |
| Buzău           |                  151 |          10 (6.6 %) |                 38 (25.2 %) |
| Vrancea         |                  138 |           6 (4.3 %) |                 18 (13.0 %) |
| Satu Mare       |                  135 |           2 (1.5 %) |                   8 (5.9 %) |
| Ilfov           |                  134 |           1 (0.7 %) |                  12 (9.0 %) |
| Dâmbovița       |                  121 |          10 (8.3 %) |                 16 (13.2 %) |
| Sălaj           |                  114 |           6 (5.3 %) |                 13 (11.4 %) |
| Iași            |                  109 |         15 (13.8 %) |                 31 (28.4 %) |
| Dolj            |                   74 |          8 (10.8 %) |                 13 (17.6 %) |
| București       |                   51 |           4 (7.8 %) |                 17 (33.3 %) |
| Galați          |                   34 |           1 (2.9 %) |                   3 (8.8 %) |
| Olt             |                   33 |           1 (3.0 %) |                   3 (9.1 %) |
| Vaslui          |                   29 |           1 (3.4 %) |                   1 (3.4 %) |
| Botoșani        |                   26 |           1 (3.8 %) |                  3 (11.5 %) |
| Brăila          |                   25 |          7 (28.0 %) |                  8 (32.0 %) |
| Giurgiu         |                   25 |           2 (8.0 %) |                   2 (8.0 %) |
| Călărași        |                   23 |           1 (4.3 %) |                  3 (13.0 %) |
| Teleorman       |                   15 |          2 (13.3 %) |                  3 (20.0 %) |
| Ialomița        |                    9 |           0 (0.0 %) |                   0 (0.0 %) |

## 7. Assumptions and unknowns

- Screening thresholds (6 and 40 persons) and urbanity inference are rubric-v1
  hypotheses.
- Register capacity is per certificate; complexes may be larger than any row.
- OSM settlement inference uses fixed radii; properties far from their
  village's place node may be assigned to a neighbouring settlement.
- Unknown: Whether any Candidate is rentable as a whole property or accepts private events (neither source states it).
- Unknown: The number of group-rental properties operating without a classification certificate.
- Unknown: Matcher precision and recall (pending independent review).
- Unknown: Stability of derived register record keys across future register versions (one version observed).
