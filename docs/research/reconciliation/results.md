# Baseline assessment, results and investment decision

## What actually existed

The current tests passed before implementation: 57 API tests, 12 web tests,
two import-boundary probes, formatting, lint, typechecking and both builds.
Research has durable imports, immutable Evidence and proposed Claims, unverified
Candidates, evaluated-by-protocol matching suggestions, text extraction and an
image integrity/captured-output harness. The isolated campaign has 42,878
Candidates and 468,502 historical Claims. The original national campaign has
42,861 Candidates. Catalog contains Categories; canonical Provider/Offer and
Curation verification/publication workflows remain unimplemented.

The assumption of completed independent evaluation is false. All 23,557 stored
Duplicate Suggestions across campaigns remain unreviewed. Text extraction has
48 retained documents and 22 current proposed observations but no independent
semantic labels. The visual experiment has three authorized images, no model
observations and no independent attribution labels. No independently adjudicated
matching decisions, owner confirmations or model results can be reused as truth.

Read-only inspection found 19 Candidate/attribute combinations with multiple
historical Claims in the selected capacity/facility targets. These are chiefly
same-Evidence reprocessing, not multiple independent sources. Current and old
extractor versions must remain distinguishable. The new comparison component
therefore abstains conservatively and never assumes a Duplicate Suggestion is
an identity decision.

## Controlled sample

The actual attribute frame has **32,305 Claims from 32,264 Candidates**. Leakage
blocking yields 29,237 conservative groups, with 31 descriptive records and zero
near-text edges found. No groups exceeded case bounds and no acquisition occurred.
The first 24-case preflight overrepresented capacities. Its immutable corpus,
24 database assessments and aggregate report remain intact. Sampling v2 balances
source-family and attribute-set buckets before annotation; this metadata-only
amendment is recorded rather than silently replacing cases.

The primary sample has 28 groups: ten reprocessed, ten cross-Candidate and eight
single-source groups. Seventeen are development and eleven holdout. Sparse
buckets can have only one development group; the sample cannot establish
holdout accuracy for those attributes. Forty-nine Evidence records comprise 33
register and 16 OSM records. Seventy-four Claims comprise 41 register-source and
33 OSM-source interpretations, including 17 superseded text-v1 and 14 current
text-v2 Claims. Reprocessing is not independent corroboration.

Overture supplies no Claims in this attribute frame; image observations, explicit
owner confirmations, event permissions, exclusive rental, yard measurements,
seasonal/historical intervals and reviewed genuine contradictions are absent.
Their behavior is tested synthetically, not demonstrated on real labeled cases.
No sample is nationally representative or independently eligibility-labeled.

## Observed before and after

| Dimension                                   |                      Before this task | After primary run | Interpretation                                                           |
| ------------------------------------------- | ------------------------------------: | ----------------: | ------------------------------------------------------------------------ |
| Campaign Candidates                         |                                42,878 |            42,878 | No discovery or merge                                                    |
| Campaign historical Claims                  |                               468,502 |           468,502 | Original assertions preserved                                            |
| Primary corpus Claims / Evidence            |                               74 / 49 |           74 / 49 | Existing inputs only                                                     |
| Primary research assessments                |                                     0 |                28 | Additional derived snapshots; 24 preflight snapshots retained separately |
| Candidate/attribute profiles                | No explicit reconciliation projection |                53 | 50 supported source assertions, three insufficient                       |
| Pair assessments                            |     No explicit scoped reconciliation |                49 | 15 equivalent, one compatible, 33 unresolved                             |
| Common-origin pair warnings                 |               Not explicitly assessed |                30 | Repeated Evidence is not independent support                             |
| Conditional cross-Candidate pairs           |               Not explicitly assessed |                19 | Candidate profiles remain separate                                       |
| Profiles with repeated active Evidence      |               Not explicitly assessed |                 7 | No independent corroboration                                             |
| Profiles retaining inactive-method warnings |               Not explicitly assessed |                16 | Old method output remains visible                                        |
| Unknown validity / freshness                |                No explicit assessment |           53 / 53 | Retrieval does not establish current truth                               |
| Independently reviewed conclusions          |                            0 reviewed |        0 reviewed | Evaluation incomplete                                                    |
| Verified / Published from reconciliation    |                                     0 |                 0 | Curation boundary retained                                               |

“Supported” means an explicit, technically grounded **source assertion** with
sufficient comparison context under the stated rules. It does not establish
semantic correctness, actual facility ownership or current commercial usability.
No newly confirmed property fact is claimed. Fifty supported assertions are not
fifty newly discovered facts or successful reconciliation judgments.

| Attribute                                                                        | Profiles | Equivalent / compatible / unresolved pairs |
| -------------------------------------------------------------------------------- | -------: | ------------------------------------------ |
| Official/advertised overnight places                                             |       36 | 13 / 0 / 18                                |
| Beds                                                                             |       10 | 2 / 0 / 4                                  |
| Recreation                                                                       |        2 | 0 / 1 / 6                                  |
| Lawn, barbecue, pool, hot tub, sauna                                             |   1 each | 0 / 0 / 1 each                             |
| Exclusive rental, yard area, private events, event attendance, pool availability |   0 each | 0 / 0 / 0 each                             |

There are no asserted conflicts in this sample, because no matching-context,
known-overlap contradiction is established. This is not conflict accuracy or
proof that the properties have no contradictions. Unknown periods and
superseded methods produce unresolved comparisons. Distinct beds and classified
places retain separate profiles; different definitions do not create conflicts.

## Quality, uncertainty and failure analysis

There are **zero independent reviewers, zero double-reviewed cases and zero
scored pairs**. Equivalence, compatibility, conflict precision/recall, false and
missed conflicts, scope errors, temporal errors, lineage errors, unsupported
conclusions and correct abstention are all **null**, including per-attribute
metrics. Zero observed review disagreements means no review occurred.

The scorer accepts two independent human review files, validates corpus/Evidence
references and complete pair coverage, excludes unresolved disagreements and
accepts third-reviewer adjudications. Counts and descriptive Wilson intervals
are executable once labels exist. They cannot manufacture the missing judgments.
Pair errors remain correlated within properties; no national accuracy claim is
supported.

Synthetic counterexamples demonstrate the intended safeguards: 16 classified
places versus 20 with extra beds; past event permission versus a later ban;
seasonal closure versus facility existence; a pool visible in an image versus
an Offer facility; shared versus private access; an invalid span; and two
extractors citing one passage. They are engineering regressions, not evidence
that difficult real-world interpretations are solved.

Known failure risks include missed/paraphrased common origins, incorrect
upstream scope extraction, overly conservative abstention for unknown dates,
unreviewed matcher links, insufficient original context and absent real temporal
examples. Source-statement truth cannot be established by a valid quote alone.
A conflict or new owner confirmation needs independently reviewed provenance,
not a universal source ranking or numerical trust score.

## Reproducibility and economics

The pinned corpus digest is
`198a008db0c56424de0fc76378fa1b7a3e317dd6f8e5cfd17a1da8ed808597a6`.
Both primary runs produce output digest
`acfcb8ec7e17e72979843e5c659265fbe744fbebb816f344d1ac781bde17550f`.
The first inserted 28 assessments; the repeat inserted zero and reused all 28.
Audit records retain both executions. New input or rule versions have separate
fingerprints; synthetic persistence tests retain earlier decisions after new
Claims. Pinned old corpora can still be replayed; fresh source material requires
a new, separately sealed corpus rather than overwriting the old one.

Observed in-process rule time was 4.81 ms and 4.57 ms for these two runs. This
excludes export, database writes, startup and human review. Serialized result
size is 44,570 bytes. PostgreSQL reports 152,429 bytes for combined input/result
JSON values across all 52 preflight and primary snapshots; this excludes table
metadata and indexes. New downloads, external model
calls and external service charges are zero. Existing source rights remain
unchanged. Local infrastructure and engineering/human-review costs were not
metered; monetary cost per validated conclusion is undefined because there are
no independently validated conclusions. No production cost projection is
presented as an observed cost.

## Investment decision

**Investigate further.** Keep deterministic comparison, origin warnings,
immutable history and Data Studio explanations as experimental review aids.
Do not automate canonical selection or treat supported profiles as independently
verified property knowledge. There is no measured case yet for broader source
reconciliation or a model arbiter.

Before expansion: independently double-review/adjudicate the holdout; resolve
property identity where comparisons cross Candidates; collect explicit validity
and provenance for already-held assertions when legally available; and test
real historical, seasonal, policy-change and independently confirmed cases.
Freeze new holdouts before tuning. Advance only rules that reduce total review
effort with acceptable false-equivalence, false-conflict and unsupported-
conclusion risk. Reject or narrow rules if their mistakes or review costs outweigh
their contribution. No acceptance criterion requires a positive result.
