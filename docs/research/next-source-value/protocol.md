# Incremental source experiment — protocol v1

Status: frozen before inspecting sampled Overture records or running matching.
Experiment version: `grp-next-source@1`; seed: `elpa-next-source-2026-10`.
No production integration decision follows from import success alone.

## Boundary and hypotheses

Use exactly one new source family: openly licensed Places datasets, specifically
Overture Places release `2026-09-23.1`. Reuse the Research acquisition contract,
immutable Evidence and proposed Claims, screening, and matcher v1. Do not change
the matcher based on holdout examples. All labels created by the implementer or
an AI remain developer observations, never independent ground truth.

| Hypothesis              | Confirmatory test                                                                                                                                                     | Rejection / unresolved result                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| H1: discovery           | At least five independently confirmed new, whole-property group rentals in the holdout, and a 95% lower precision bound above 50% among reviewed apparent discoveries | Fewer than five or a lower bound at/below 50% fails the investment gate; no independent labels means unresolved, not zero discoveries          |
| H2: priority enrichment | At least 20% of independently reviewed, correctly matched properties gain one previously unknown, explicitly supported priority attribute                             | Below 20% rejects H2 for this sample; absent source fields count as unknown, never false                                                       |
| H3: geographic value    | Compare apparent-discovery rates in low-overlap counties with higher-overlap controls                                                                                 | Exploratory only: county choice is purposive and no national inference is supported                                                            |
| H4: economics           | Measure acquisition/processing wall time, bytes, failures, reviewed new properties, and distinct supported attribute gains                                            | No reviewed successes makes cost per confirmed result undefined; unknown labour prices and maintenance costs prevent a monetary ROI conclusion |

Production integration additionally requires resolved commercial-use boundaries,
independent review of false merges, and an operational owner. A negative or
inconclusive result is a valid outcome. Thresholds are investment gates, not a
claim of adequate statistical power.

## Frame and sampling

Query the official anonymous S3 Places release through its documented Parquet
interface. Filter point bounding boxes to Romania's bounding rectangle
`20.2 <= longitude <= 29.8`, `43.5 <= latitude <= 48.3`, require a source address
with country `RO`, and require `lodging` in the primary taxonomy hierarchy.
Record provider/licence combinations before accepting any sample. Only records
whose every contributing provider has documented permissive terms may enter
the adapter. Exclusions and failed requests remain in the acquisition log.

Six purposively chosen counties: Bihor, Maramureș, Constanța (low baseline
register/OSM reconciliation), Brașov (higher overlap), Cluj, and Harghita
(controls). Membership uses the source's address region, not guessed county
boundaries. Unrecognised regions are counted and excluded from the six-county
sample. Country and region are source assertions, not verified geography.

Within each county, stratify by county-seat address versus other/unknown
locality, primary category group (whole-dwelling hint / hotel-like / other),
and presence versus absence of website/social fields. Rank by SHA-256 of
`seed|source-native id`, then take the first two in each stratum: at most 144
records. Do not replace failures or small strata. The locality split is an
urbanity proxy; other localities must not be called rural without evidence.
This is a disproportionate stratified sample of a restricted frame, not a
representative national property sample. Report frame counts and inclusion
probabilities; any weighted inference applies only to the six-county frame.

Partition with the existing `grp-eval-partition@1` identity hash: first byte
below 77 is development (~30%), otherwise holdout. Develop using synthetic records and
development records only; keep holdout source content out of tuning. Sample
within strata without conditioning on matcher outputs. Review later stratifies
the holdout by likely match / possible match / unmatched / excluded / unresolved.
Unmatched is not new; new requires a baseline search and whole-rental evidence.

## Attributes and evidence

Evaluate only explicit source fields against the existing taxonomy:
`sleeps_persons`, `max_daytime_guests`, `outdoor_grill`,
`outdoor_covered_area`, `pool`, `hot_tub`, `parties_allowed`,
`music_policy`, and `quiet_hours_start` / `quiet_hours_end`. Whole-property
rental, yard, terrain, recreation, and team-building permission are review
dimensions; no new Claim keys are introduced for concepts without an accepted
key in the current taxonomy. Match source field availability first; do not
visit linked websites as an undeclared second acquisition family. Overture's
published schema suggests these fields may be absent; H2 is allowed to fail.
Website/social/coordinate gains are exploratory identity enrichment, not proof
of these priority attributes or of independent corroboration (upstream data may
be copied from the same operator page).

For correctly matched properties classify each distinct target/value as already
supported, new explicit evidence, uncertain inference, contradiction, or unknown.
Do not count repeated same-value statements as new facts. Do not combine room,
bed, site, or certificate capacity as though they were whole-property capacity.
Marketing categories or photographs never establish permission for events.

## Review and uncertainty

Export a versioned blind holdout sheet, source-native evidence references,
candidate search links, and a separate hidden prediction key. Reviewers inspect
the original source fields and baseline Evidence, search beyond suggested pairs
to find matcher misses, and record evidence URLs/locators, reviewer identity,
time, ambiguity, and notes. Allowed discovery decisions: existing, new_in_scope,
out_of_scope, cannot_determine. Pair decisions: same_property,
same_provider_only, different, cannot_determine. Two independent human reviews
plus adjudication are preferred; disagreements remain visible. For this
Category the comparison unit is the same physical property / independently
bookable Offer, not Operating Location (the glossary excludes it here).

Use the existing Wilson interval helper for reviewed proportions. Show sample
sizes and unresolved rows; do not invent precision/recall, independent labels,
confidence intervals for unreviewed decisions, or a national coverage denominator.
No independent reviewer has been supplied at protocol creation.
