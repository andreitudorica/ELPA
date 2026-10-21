# Observed baseline and primary material

Inspected AGENTS, CONTEXT, ubiquitous language, architecture/data model, ADRs
0013/0014/0019–0023, application READMEs, product extraction guidance, Research,
Catalog, Curation, Audit and previous evaluation/review packs before extending
the workflow. Codebase Memory supplied structure and source snippets; its
installed skill file was unavailable in both configured skill roots and the
local installation, but the MCP index was ready. Baseline checks passed **17 API
and 10 web tests**. Those tests were not independent property annotations.

The original national campaign still contains 42,861 source-keyed Candidates
and 468,223 Claims: register 32,216 / 397,491 and OSM 10,645 / 70,732. These
are unresolved records, not unique eligible properties. All Candidates are
unverified and Claims proposed. The prior source experiment reproduced A+B in
an isolated campaign, then added 17 Overture Candidates. That campaign is this
experiment's frame: 42,878 Candidates, with 468,455 historical Claims before
extraction (including both Overture method versions).

The original baseline covers all 42 Romanian county codes. Register overnight
capacity is populated for 32,182 Candidates; OSM coordinates are complete but
the earlier adapter did not extract detailed description amenities. Register
websites are 9.55% complete and OSM websites 18.96%. Source expansion did not
independently prove new properties or high-value attribute enrichment. See
the [measured baseline](../next-source-value/baseline-assessment.md) and
[source experiment results](../next-source-value/results.md).

The matcher works operationally and reproduced its suggestions, but the old
352-item review sample and new-source holdout still lack independent labels.
ER precision, recall, false merges and eligible-property counts remain unknown.
Its possible/likely links can conservatively group potential copies for leakage
protection; they are not validated Operating Location identities.

Catalog currently owns Categories only. Curation and Recommendation modules
remain empty. Research persists Evidence, Claims and acquisition/matching
history with Administrator audit and transaction boundaries. Data Studio has
admin Candidate detail, source snapshots and run history; its existing list
suggestion-count defect remains outside this task.

## Original evidence and rights

Latest Evidence consists of native structured rows/tags, not retained HTML or
AI summaries. OSM has 322 `description` tags plus one each in the retained
English/Romanian/Hungarian description fields across the imported population;
some coexist on the same record. Other observed tags include 546 `rooms`,
78 `beds`, 19 `swimming_pool` and two `sauna` values. These are raw key counts,
not verified facilities. Register fields principally contain classification,
capacity and address information. The Overture sample contains identities,
categories and links, without primary property descriptions.

The primary-field projection preserves original values and stable field paths,
not earlier Claims. A numeric source scalar is rendered as its original scalar
text; no unit or descriptive sentence is invented. OSM `rooms` and register
`Număr spații` are retained for review but never equated with bedrooms. A generic
OSM `capacity` is not treated as overnight capacity.

| Material                     | Existing terms and experiment treatment                                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register XLSX / retained row | No explicit reuse licence; prior personal-data redaction remains. Restricted internal experiment only; no public rows or external model transfer. Commercial republication is unresolved.                                                                                   |
| OSM PBF / retained tags      | ODbL attribution and downstream database obligations remain applicable. Private text exports omit contact fields; four contact/URL-bearing fields are excluded from the complete frame. No claim that this authorizes public combined-database use or external AI transfer. |
| Selected Overture records    | Existing Meta/Microsoft CDLA-Permissive-2.0 sample; no contact fields or rich text acquired here. Linked websites are separate sources and are not fetched.                                                                                                                 |

Pinned artifacts and versions are in the manifest. Earliest retainable source
records remain in PostgreSQL and privately archived original artifacts; the
corpus is an allowlisted primary-field view. Recall is therefore measured
**within that view**, not over an entire website or every source tag. A field
allowlist can omit useful source statements; that limitation must not be hidden
by high extraction scores. Privacy filtering is a bounded minimization rule,
not a general de-identification guarantee; reviewers must handle the pack
privately. Source accuracy/freshness is separate from extraction accuracy.
