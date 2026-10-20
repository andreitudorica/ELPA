# Ground-truth evaluation protocol

Status: **sample drawn, review not started.** No ground-truth label exists yet,
so no precision, recall, or F1 is reported anywhere. This protocol defines how
independent labels are produced and scored.

## Versioned dataset

| Element        | Value                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample version | `grp-eval-sample@1`, seed `elpa-grp-baseline-2026-10`                                                                                           |
| Partition      | `grp-eval-partition@1`: records whose hashed identity falls in the first 77 of 256 buckets (~30 %) are _tuning_, the rest _evaluation_          |
| Matcher        | `grp-duplicate-matcher@1`                                                                                                                       |
| Inputs         | Register artifact version 2026-10-21; OSM replication timestamp 2026-10-19T20:21:11Z                                                            |
| Manifest       | [`data/evaluation-sample-1.manifest.json`](./data/evaluation-sample-1.manifest.json) (record keys, strata, population sizes; no source content) |

The sample is drawn only from the **evaluation partition**. Rules were tuned on
the tuning partition (see [entity resolution](./entity-resolution.md)), so the
two sets of examples are disjoint by construction. Within each stratum, items
are ranked by a seeded hash of their source record identity and the first
_quota_ are taken: the same inputs always yield the same sample, and no item is
chosen by looking at its content.

## Review tasks and strata

| Task                      | Question for reviewers                                                                                                      | Strata                                                                                                       | Quota | Items |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| `record_match`            | Starting from a register record (screened plausible or ambiguous): is there an OSM object for the same property? Which ids? | matcher outcome (likely / possible / none) × urbanity × structure group                                      | 4     | 136   |
| `pair_match`              | Do these two records describe the same property?                                                                            | source pair × relation × strength × decision rule                                                            | 6     | 127   |
| `pair_match` (hard cases) | same                                                                                                                        | identical names in one county that the matcher did **not** suggest; one register operator in two settlements | 12    | 24    |
| `eligibility`             | Under [rubric v1](./population-definition.md), is the property rentable whole for a group stay or private event?            | source × screening class × urbanity                                                                          | 5     | 65    |

Total: 352 items in 75 strata. The record-centric task makes **missed
duplicates observable** (recall), which a sample of suggestions alone cannot.
The strata cover different counties (via hash ranking across the national
population), urban and rural settings, structure groups (guesthouses,
rooms/apartments, whole dwellings, complexes), exact and approximate matches,
similar names for different properties, same-operator/different-location
cases, and multi-unit complexes. **Gap:** sparse records (OSM objects without
a name or address, register rows without an address) are not a separate
stratum in sample v1; they appear only in proportion to their share. The next
sample version should add a completeness dimension to the strata.

## Producing the review sheet

```sh
pnpm --filter @elpa/api research evaluation-sample \
  --campaign <campaign-id> --out .data/evaluation/grp-eval-sample-1
```

This writes, under the ignored `apps/api/.data/` directory:

- `review-sheet.csv` — blind sheet for reviewers: item id, task, question,
  both records' names, settlements, county, structure details, and a link (OSM
  URL or Data Studio Candidate). It contains **no matcher decision, score, or
  stratum outcome**.
- `sample-key.json` — the matcher outcome per item, used only for scoring.
- `manifest.json` — the committed manifest's source.

The sheet contains register data whose redistribution terms are unconfirmed,
so it is shared with reviewers privately and never committed.

## Review procedure

1. Two reviewers work **independently**, each on a copy of
   `review-sheet.csv`, filling `reviewer_id`, `reviewed_at`, and `decision`
   from the `allowed_decisions` column.
2. Reviewers must inspect original evidence: the OSM object and its map
   context, the Data Studio Candidate with its register Evidence, and public
   sources such as the property's own website or listing. Every decision lists
   the consulted URLs in `evidence_urls`.
3. For `record_match`, list every matching OSM object in `counterpart_osm_ids`
   (`node/123`, `way/456`, or OSM URLs).
4. Record `ambiguity` (`none`, `minor`, `major`) and use `cannot_determine`
   rather than guessing. `notes` explain borderline cases.
5. Decisions use the evidence standards in the
   [population definition](./population-definition.md#evidence-required-for-review-decisions).
   Similar names, the same village, or the same operator are not sufficient
   evidence of the same property.
6. **Adjudication**: a third person resolves disagreements in a separate CSV
   with `reviewer_id = adjudicator`. Adjudicated decisions override reviewer
   decisions; unresolved disagreements are reported as disputed and excluded.

## Scoring

```sh
pnpm --filter @elpa/api research evaluation-score --campaign <campaign-id> \
  --sample .data/evaluation/grp-eval-sample-1 \
  --labels reviewer-a.csv --labels reviewer-b.csv --labels adjudication.csv
```

The score (`score.json`) reports, with 95 % Wilson intervals:

- **Pair precision** per tier (`likely` = automatic tier, `possible` = review
  tier), per source pair and relation; for same-provider suggestions, a
  "same property" or "same provider" label counts as correct.
- **Hard-case specificity**: share of unsuggested hard pairs confirmed as
  different properties.
- **Record-level recall** at `likely` and at `likely or possible`, **precision**
  of `likely` counterparts, **F1**, the **false-positive rate** among records
  without a counterpart, and the item ids of false merges and missed
  duplicates for inspection.
- **Eligibility**: share labelled `in_scope` per screening class.
- **Agreement**: Cohen's kappa per task between the first two reviewers, plus
  counts of single-reviewer, disputed, and invalid labels.

Metrics are sample-level and unweighted. Stratum population sizes are in the
manifest, so population-weighted estimates can be computed when needed. An
item labelled by only one reviewer is reported as such and should not be used
for headline metrics.

## Rules that protect the result

- Labels are never generated by the matcher, by screening, or by an AI agent.
- The evaluation partition is not used to tune rules. A new matcher version
  requires a new sample version if the old sample's items were inspected
  during development.
- Results are published as aggregates; per-item labels stay with the sample.
