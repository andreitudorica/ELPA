# Comparative quality report and investment decision

**Investigate further.** The deterministic pipeline is usable for proposing
reviewable Claims. Independent semantic reliability and marginal AI value have
not been established, so no extraction method is promoted to production.

## Observed experiment

The 42,878-record frame formed 34,362 conservative leakage groups using existing
same-property suggestions and textual copies. One near-duplicate text edge was
found. These are partition groups, not a measured unique-property inventory.
The seeded draw selected 48 distinct groups, 24 per partition, across 22
counties. Source counts are OSM 32, register 12, Overture four. Sixteen documents
contain descriptive text, 20 have structured fields only and 12 are empty
projection controls. Four contact-bearing fields were excluded from the frame;
none belonged to the selected sample. No failed record was silently replaced.

The documents include urban, rural and unknown locality classifications from
the existing read model; those classifications are themselves unverified.
Sixteen documents contain Romanian diacritics and 20 nonempty documents have no
diacritics. Mixed-language keyword diagnostics are exploratory proxies, not a
validated language classifier. The sample is geographically uneven (14 records
in Constanța), includes accommodation outside the group-rental screening scope,
and is neither representative nor eligibility-labeled. Event rules, seasonal
restrictions and contradictions have **no extracted real examples** in this
sample; their synthetic tests do not establish real-world recall or absence.

| Dimension                                                                      |     Before |      After |                                                Change |
| ------------------------------------------------------------------------------ | ---------: | ---------: | ----------------------------------------------------: |
| Source-keyed Candidates in isolated campaign                                   |     42,878 |     42,878 |                                                     0 |
| Stored Claims in isolated campaign, including history                          |    468,455 |    468,502 | +47 across two versions; 22 current extraction Claims |
| Sample documents                                                               |         48 |         48 |                                                     0 |
| Proposed populated Candidate/attribute cells in selected 25-attribute ontology | 14 / 1,200 | 21 / 1,200 |                                              +7 cells |
| Same-Evidence values already proposed                                          |         14 |         14 |                           0 independent corroboration |
| Additional distinct proposed observations                                      |          — |          8 |                                  Semantics unreviewed |
| Independently reviewed supported facts                                         | 0 reviewed | 0 reviewed |                                 Evaluation incomplete |
| Source/span technical failures                                                 |          — |     0 / 22 |                                  Technical check only |
| Documents with no proposed Claim                                               |          — |    30 / 48 |                                   Observed abstention |
| External model calls                                                           |          0 |          0 |                                                     0 |

Proposed completeness rises from 1.17% to 1.75% in this deliberately broad
sample/ontology matrix. This is **not supported-fact completeness**, an
eligibility rate, or a national coverage figure. Three recreation facts can
occupy two Candidate/attribute cells; observation and cell counts differ.
Re-extracting the same register capacity is not new knowledge. No new source
was acquired and no independently supporting second document was introduced.

| Attribute                       | Proposed facts (holdout) | Same Evidence/value already proposed |
| ------------------------------- | -----------------------: | -----------------------------------: |
| Overnight guests                |                   12 (6) |                                   12 |
| Beds                            |                    2 (1) |                                    2 |
| Lawn                            |                    1 (0) |                                    0 |
| Barbecue                        |                    1 (1) |                                    0 |
| Pool                            |                    1 (0) |                                    0 |
| Hot tub / ciubăr                |                    1 (0) |                                    0 |
| Sauna                           |                    1 (1) |                                    0 |
| Recreation facilities           |                    3 (3) |                                    0 |
| Each of the other 17 attributes |                    0 (0) |                                    0 |

Critical attributes with zero output include exclusive rental, bedrooms,
bathrooms, yard area/terrain, private-event permission, team-building, event
attendance, music/quiet-hour restrictions and outdoor-event hosting. Zero
output is not zero recall: their independently labeled denominators are unknown.
The full [observed report](./data/observed-report.json) and
[per-attribute quality report](./data/deterministic-score.json) keep all 25
attributes visible.

Version 1 proposed 25 observations. A final synthetic duration/price regression
case motivated the separately versioned `grp-text-rules@2`, which requires
person units or an unambiguous standalone `sleeps` statement. Version 2 emits
22 observations on the same still-blind corpus. The three removed outputs are
not independently adjudicated errors: no holdout passages or labels were
inspected. All 25 v1 Claims remain historical; both versions and their repeats
have durable runs/Audit records. The [v1 aggregate snapshot](./data/v1/observed-report.json)
is retained, so the lower current count is not hidden.

## Quality and comparison

There are **zero independent reviewers and zero scored holdout cells**.
Precision, recall, F1, semantic unsupported-claim rate, missed-fact rate,
normalization, entity scope, negation and temporal accuracy remain **null** for
every attribute and in aggregate. Disagreements, adjudications and kappa are
unobserved, not evidence of perfect agreement. Technical checks validate 22
references/spans; their observed failure rate is 0/22 (descriptive Wilson 95%
interval 0–14.87%, without a document-correlation correction). A matching quote
cannot prove that a pool belongs to the property.

The scorer is executable against independently completed labels and uses strict
fact matching plus separate double-reviewed claim-error judgments. Unlabeled
cells are excluded explicitly, not converted into correct abstentions. Invalid
source references are a separate error category. Synthetic behavioral tests
cover normalization, diacritics, negation, seasonal closure, approximate area,
unknowns, contradictions, wrong scope, invalid spans, annotation disagreement,
reprocessing, method changes and transactional persistence/audit sequencing.

Method A ran on both partitions and persisted proposed Claims. Method B has a
versioned prompt, strict schema, capture metadata, quarantine/import boundary,
cost/latency fields and the same-corpus scorer; it was **not executed** because
no approved model/budget/transfer basis was supplied. Method C was not selected:
there is no measured AI advantage from which to justify a hybrid. Additional
correct AI facts and cost per additional correct fact are undefined. No model
outputs, calibrated probabilities or benchmark outcomes were invented.

## Error risks and development counterexamples

Only development texts informed vocabulary changes (`jacuzi`, `grass surface`).
Examples are referenced by source key in the private corpus; source passages
are not republished here. A development description calls a place a private
villa but does not state exclusive rental. Another describes room-level
accommodation; generic room counts must not become bedrooms. Landscape prose
without amenities produces no property-facility Claims. These are developer
observations, not independent labels. Holdout passages were not inspected or
used to tune rules; aggregate output counts were inspected after freezing rules.

Rules are intentionally narrow and can miss inflected, indirect, English or
mixed clauses. Clause-wide negation and proximity filters can over-abstain or
misread complex conjunctions/double negation. Seasonal wording and approximate
capacities need independent review. The projection excludes some source fields,
so reported recall cannot describe complete websites or every retained tag.
Conservative grouping cannot guarantee separation of every unresolved real
property or paraphrased copy. Source statements can themselves be inaccurate
or stale even when extracted perfectly.

## What would change the decision

Complete independent double annotation/adjudication, including claim-error
judgments. Obtain enough lawful primary examples for each critical attribute
before judging its precision/recall, particularly explicit event policy,
negation and seasonal restrictions. Keep future tuning out of this holdout.
Only then run an explicitly authorized bounded model comparison, with known
transfer rights, model identity and budget. Promote only attribute/method pairs
that meet the frozen quality gates and lower total review effort. Evidence of
poor semantic precision, negligible new facts or disproportionate review costs
would support rejecting that method. No requirement forces AI to win.
