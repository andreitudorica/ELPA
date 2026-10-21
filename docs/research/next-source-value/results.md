# Incremental discovery, attribute value, and investment decision

Decision: **Investigate further. Do not promote Overture to production on this
evidence.** The experiment ran successfully, but it did not prove new eligible
property yield or priority-attribute enrichment.

Machine-readable evidence: [comparison](./data/incremental-report.json),
[sampling manifest](./data/sample-manifest.json),
[acquisition context](./data/frame-acquisition.json), and
[independent review status](./data/independent-review-score.json).

## Observed sample and failures

Freshness is a material limitation: all 17 sampled primary-contributor entries
state version `2025-10-20`; their `update_time` values range from
`2022-01-31T16:30:37.130Z` to `2025-10-14T12:46:58.190Z`. These are source
metadata observations, not proof of when amenities were last checked. A
September 2026 release must not be presented as fresh property verification.

The fixed release query returned 21,716 lodging records with a Romanian address
inside the declared bounding rectangle. Processing the frame excluded 105
records outside the chosen CDLA provider profile, 21,582 without a resolvable
county, and 10 in other counties. The remaining six-county frame contained only
19 records; the frozen stratified plan selected 17. Empty/small strata were not
filled from elsewhere. Six records belong to development and 11 to the holdout.

This is an adverse result for the **address-region sampling method**, not proof
that Overture has only 19 relevant Romanian properties. Restricting to records
with county metadata creates severe selection bias. In particular, the sample
does not support an estimate for rural properties or national discovery yield.
Coordinate-based county inference is a separate, prospective experiment; it was
not introduced after observing this sample to improve the result.

The initial import created 17 Evidence rows, 17 Candidates, and 116 proposed
Claims, and its repeat created no duplicates. During implementation, adapter v2
corrected Evidence content identity: file/release context is held on the artifact
rather than included in native record content. This preserves reuse of unchanged
records across future releases. V1 Evidence and Claims remain immutable history;
v2 adds 17 corrected Evidence snapshots and 116 Claims against them, with no new
Candidates. These historical interpretations are not additional supported facts.
V2 parsed 17/17 records and its repeat created zero Evidence, Candidates or Claims,
reproducing digest
`c4cf1969214bd4e59d399156198d364700591bbe1fe1cf039b577c8d5e19eb46`.
All Candidates remain unverified and all Claims proposed. Transport-level HTTP
requests/retries were not instrumented; zero parse failures is not a claim of
zero network retries.

## Discovery and overlap

Classification precedence is screening exclusion, insufficient identity,
then likely / possible / no same-property baseline suggestion. Same-provider
suggestions never count as a property match. All classifications are unreviewed.

| Classification                                      | Entire sample | Holdout |
| --------------------------------------------------- | ------------: | ------: |
| Likely existing property, pending pair review       |             2 |       2 |
| Potential existing property requiring review        |             2 |       2 |
| Apparent discovery, novelty and eligibility unknown |             4 |       1 |
| Screened out of scope                               |             9 |       6 |
| Unresolvable identity                               |             0 |       0 |
| Independently reviewed records                      |             0 |       0 |

Matching compared 466,413 pairs after the sample versus 465,426 before (+987),
and stored 23 additional suggestions: 2 likely and 18 possible same-property
suggestions, plus 3 possible same-provider suggestions. There were no automatic
merges. The classification table counts source records; the suggestion counts
count pairs, including suggestions involving records screened out of scope.

No apparent discovery is called a confirmed new property. H1's investment gate
is not established. Even if the one holdout apparent discovery were confirmed,
this sample would not meet the predeclared five-discovery threshold. No reviewed
precision, recall, false-merge rate, unique-property yield, or confidence interval
can be reported without independent decisions.

## Attribute value

The evaluated priority Claim targets are the ten existing taxonomy keys in
`PRIORITY_TARGETS`: overnight and event capacity, party permission, quiet hours,
music policy, barbecue, covered outdoor area, pool, and hot tub.

**None of the 17 source records supplied any of those priority observations.**
The direct-source overnight-capacity count remains 32,182 baseline Candidate
observations, and all nine other evaluated target counts remain zero. There
are zero newly extracted priority facts, zero observed priority contradictions,
and no basis for asserting a negative amenity or event restriction. Missing is
unknown. Yard, slope, recreation and whole-rental permission likewise have no
supporting fields in this acquired source material; no new Claim keys or
marketing-based inferences were introduced for them.

The source provides names, address/locality and inferred bbox-centre coordinates
for 17/17 records, and website/social identities for 14/17. There are three
additional website identities conditional on unreviewed likely property links.
These are Candidate-level identity hints, **not three independently supported,
deduplicated property facts**. No linked website was crawled. Independent
corroboration is unknown because Overture's upstream contributor may have copied
the operator's own material. H2 finds no support in this sample: the desired
attribute-depth improvement was not observed.

One development record (`eefb540c-3f97-4c0d-9cd3-c0883bdcbf5e`) exhibits a
name/category inconsistency on inspection. This is a developer-raised review
flag, not an independent out-of-scope label. No extraction or matching rule was
tuned using this anomaly or any holdout record.

## Geographic contribution

| County    | Baseline Candidate records | Added records | Likely / possible existing | Apparent discoveries | Screened out |
| --------- | -------------------------: | ------------: | -------------------------: | -------------------: | -----------: |
| Bihor     |                      1,341 |             3 |                      1 / 1 |                    0 |            1 |
| Brașov    |                      4,243 |             1 |                      0 / 0 |                    1 |            0 |
| Cluj      |                      1,948 |             4 |                      0 / 0 |                    2 |            2 |
| Constanța |                      7,115 |             6 |                      0 / 1 |                    1 |            4 |
| Harghita  |                      1,351 |             2 |                      0 / 0 |                    0 |            2 |
| Maramureș |                      1,648 |             1 |                      1 / 0 |                    0 |            0 |

H3 is exploratory and inconclusive: tiny, disproportionate strata and missing
county metadata prevent a defensible regional or national yield comparison.

## Before and after

| Dimension                                                    | Baseline                                 | After source                                         | Change / interpretation                                                     |
| ------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Source records read, one latest import per source            | 42,876                                   | 42,893                                               | +17; repeat imports do not increase the denominator                         |
| Source-keyed Candidate records                               | 42,861                                   | 42,878                                               | +17 records, not properties                                                 |
| Screened plausible or ambiguous records                      | 20,573                                   | 20,581                                               | +8; automated prioritisation only                                           |
| Unique in-scope properties                                   | Unknown                                  | Unknown                                              | Not established                                                             |
| Independently confirmed new properties                       | Not measured                             | Not measured                                         | No independent review performed                                             |
| Distinct-property cluster scenarios across all accommodation | 34,360–39,850                            | 34,362–39,864                                        | Conditional cluster counts, not a CI or an eligible-property yield estimate |
| Additional priority attribute observations                   | 0 from this source                       | 0                                                    | No priority enrichment                                                      |
| Independently supported additional facts                     | Not measured                             | Not measured                                         | Review pending; source observations are not independent truth               |
| Priority completeness of correctly matched properties        | Unmeasured                               | Unmeasured                                           | No new source priority fields; conditional gain zero                        |
| Geography                                                    | National two-source baseline             | Same baseline + six-county sample                    | See county table; no national market-coverage percentage                    |
| Entity-resolution error                                      | Unmeasured                               | Unmeasured                                           | More suggestions do not prove accuracy                                      |
| Acquisition cost                                             | Original marginal costs not instrumented | New frame query 214.179 s; 27,911,289 retained bytes | See economics report; no monetary ROI claim                                 |

## Investment decision and evidence that would change it

**Investigate further**, with no production promotion or recurring schedule.
Access and deterministic import are demonstrated. Commercially useful
whole-property discovery and event/amenity depth are not. The narrow geographic
frame and lack of independent labels prevent an investment claim from the four
unmatched records. The frame result also invalidates treating the current sample
as representative of the source's national potential.

A new, preregistered experiment could reuse baseline county geometry to sample
by coordinates, retain records lacking address regions, and obtain independent
review of novelty, exact property identity, and whole-rental eligibility. It
must keep this v1 result and holdout unchanged, budget review effort, and settle
the production OSM/commercial-use boundary before public use. Operator websites
remain a separate permission-dependent enrichment hypothesis, not an undeclared
second adapter. If a larger permitted sample still yields no useful discoveries
or unacceptable false matches, reject this source for the next investment.
