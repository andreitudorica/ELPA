# Observed results and decision

## Decision

**No category is enabled.** Every gate is closed because there are zero
independent reviewers. The evaluation was recorded as
`independent_labels_missing` (evaluation `01a160dc-8fad-7ace-92c0-2f36002e4b3b`),
and an attempted approval of `register_locality` was refused. No Claim was
verified or published. Accuracy, false-approval rates, calibration error and
cost per correct fact are **not measured**; they are not estimated from model
agreement or developer judgement.

The figures below are observed system outputs on the 824-item corpus. They show
what the policy _would_ do and what it costs, not whether it is right.

## Strategy comparison (observed, unlabelled)

Recommendations per category (`auto_verify` = would be verified if the gate were open):

| Category                       | Items | A: deterministic | B: + model on all | C: selective (operational) |
| ------------------------------ | ----: | ---------------: | ----------------: | -------------------------: |
| `register_locality`            |   245 |              244 |               244 |                        244 |
| `osm_county`                   |   245 |              245 |                 2 |                        245 |
| `register_classified_capacity` |   245 |              227 |               203 |                        227 |
| `explicit_text_facility`       |     5 |                0 |                 2 |                          2 |
| `property_shape_count`         |    46 |                0 |                 0 |                          0 |
| `high_consequence`             |    38 |                0 |                 0 |                          0 |
| **Total**                      |   824 |              716 |               451 |                        718 |

|                        | A                                       | B      | C      |
| ---------------------- | --------------------------------------- | ------ | ------ |
| Model calls            | 0                                       | 824    | 89     |
| Model cost (USD)       | 0                                       | 4.3126 | 0.4323 |
| Summed model latency   | 0                                       | 35 min | 4 min  |
| Policy processing time | 38 ms for all 824 items, all strategies |        |        |

Why the strategies differ:

- **OSM county:** the model correctly declines to confirm a county from a
  boundary-containment inference, because no passage states the county and world
  knowledge is forbidden (149 insufficient evidence, 13 uncertain, 81 rejected
  outputs). Strategy B therefore abstains on almost all of them. The model adds
  cost and no verifiable signal here, which is why C does not call it.
- **Classified places:** 15 items are deferred by every strategy because two
  register records the matcher links have different capacities (a real
  conditional contradiction); 3 are superseded text re-readings of the same field.
  B loses 24 more, all to rejected outputs that quoted `Număr locuri: 2` instead
  of the verbatim field text.
- **Text facilities:** A cannot verify them (assessment required); C proposes 2.
  One development example, "a grass surface" offered as a lawn, was judged
  `uncertain`.
- **Counts:** 43 items are deferred because independent corroboration does not
  exist for crowd-sourced counts; 2 are rejected as out-of-range counts and 1 is a
  superseded method.
- **High-consequence:** never autonomous (37 not eligible); one OSM
  `capacity=0` is rejected by validation.
- **Register locality:** one register row has no settlement and is rejected.

## Model assessor measurements

| Measure                                   | Observed                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Model, prompt                             | `claude-sonnet-5-5` (all 824 served by it), prompt `@1`, effort low                                                 |
| Calls                                     | 824 succeeded; 4 earlier set-up attempts failed before any model work (missing credentials, workspace header), US$0 |
| Tokens                                    | 1,325,451 input, 166,171 output, 0 cache reads                                                                      |
| Cost                                      | US$4.3126 total, US$0.00523 per call                                                                                |
| Latency                                   | p50 2.4 s, p90 3.2 s, max 10.1 s                                                                                    |
| Stop reasons                              | 824 `end_turn`; no refusals, no truncation                                                                          |
| Accepted / rejected outputs               | 717 / 107 (13.0 %)                                                                                                  |
| Invented Evidence references              | **0**                                                                                                               |
| Quotes not verbatim in the cited passage  | 104 (OSM county 79: mostly quoting ELPA's inference metadata; classified places 25: field name plus value)          |
| Support or contradiction without citation | 3                                                                                                                   |
| Verdicts (accepted)                       | 541 supported, 151 insufficient evidence, 25 uncertain, 0 contradicted                                              |

The 13 % rejection rate is a strict grounding rule working, not model
fabrication: every rejected quote outside the holdout either restated ELPA's own
inference fields or added the field name. A clarified prompt is a candidate for a
new prompt version; it cannot be tuned into this frozen result.

## Selective follow-up research

No item qualified. The follow-up resolves OSM counties deferred by a
conditional conflict with a register counterpart, and the matcher never proposes
duplicates across counties (0 of 10,965 same-property suggestions in the
campaign). It made no network calls and cost nothing. Whether additional research
improves verification is therefore **unmeasured**; the frame offers no case where
the bounded actions apply. Live sources (operator websites) remain unauthorized.

## Conditions present and absent in real data

| Condition requested               | In this corpus                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Correct explicit facts            | Expected among register items; unlabelled                                        |
| Unsupported extraction outputs    | Superseded text-rule outputs (2 in sample)                                       |
| Negated statements                | **Absent** in real Claims (extraction abstains on negation)                      |
| Outdated claims                   | Superseded methods present; no outdated dataset version                          |
| Incorrect property attribution    | Possible via unreviewed suggestions; unmeasured until labels                     |
| Correlated source copies          | 36 reprocessed register capacity Claims in frame; common-origin lineage recorded |
| Genuine contradictions            | Register-to-register capacity conflicts (15 deferred); **none** for county       |
| Seasonal facilities               | **Absent**                                                                       |
| Ambiguous capacities              | OSM `capacity` and text capacities in the high-consequence sample                |
| Private-event permission disputes | **Absent** — no `parties_allowed` Claim exists                                   |
| Visually suggested features       | **Absent** — no image observation Claim exists                                   |

Synthetic unit tests cover the absent conditions' handling; they are not
evaluation data.

## Development observations (not labels)

- An OSM object inferred in Sibiu county names Reșița (Caraș-Severin) as its
  nearest place. Boundary inference or the nearest-place radius may be wrong for
  some objects; reviewers will measure it.
- The validator wrongly rejected register localities with an empty optional
  component-locality field; fixed on development before freezing.

## Acceptance criteria

| Criterion                                                     | Status                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Original Evidence preserved and traceable                     | Met — no Research write; decisions keep Evidence and Claim ids                      |
| Explicit versioned policy                                     | Met — policy, validator, follow-up, prompt and corpus versions                      |
| Unsupported categories cannot become Verified                 | Met — engine, write boundary and database constraints; 8/8 forbidden writes refused |
| AI assessor cannot approve or publish                         | Met — adapter returns captures only; lint boundary; tests                           |
| ≥ 1 eligible category evaluated with independent labels       | **Not met** — zero independent labels; review pack and scorer ready                 |
| Calibration and evaluation use real measurements              | Partly — real outputs, costs and latencies; correctness awaits labels               |
| False approvals, abstentions and coverage reported            | Abstentions and coverage observed; false approvals unmeasured                       |
| Decisions explainable and reproducible                        | Met — inputs, versions and digests stored; reruns are idempotent                    |
| Model calls and costs tracked                                 | Met — per call and in aggregate, under a US$15 cap                                  |
| Conflicts and insufficient evidence handled without invention | Met — contradictions and deferrals recorded; follow-up can end unknown              |
| Publication explicitly separate                               | Met — pinned column, no publication path, blocked reasons shown                     |
| Repository checks and tests pass                              | Met — see [validation](./validation.md)                                             |

## What would change the decision

Two independent reviewers label the 413 holdout items and one reviewer (with 25 %
overlap) the 339 calibration items; an adjudicator resolves disagreements; then
`verification-score` and, for any passing category, `verification-approve`. The
likeliest candidates are `register_classified_capacity` and `register_locality`.
If a gate fails, the category stays closed and the failing items show which rule
to fix in a new policy version.
