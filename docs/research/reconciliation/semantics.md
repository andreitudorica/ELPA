# Reconciliation semantics and evidence independence

Rule set: **`grp-reconciliation@1`**. Comparison input and result schemas live in
[`contracts.ts`](../../../apps/api/src/research/reconciliation/contracts.ts);
[`data/proposition.schema.json`](./data/proposition.schema.json) is generated
from the Zod proposition schema. The existing attribute ontology remains
`grp-attributes@1`. No extracted attribute is added.

## Comparable propositions

The bounded set is overnight guests, beds, exclusive rental, yard area, lawn,
barbecue, pool, hot tub, sauna, recreation, party policy, event attendance and
pool availability. A proposition retains Candidate and Evidence identity,
entity level, scope, normalized value/unit, capacity definition, access context,
seasonal months, approximation/ambiguity, explicitness, validity endpoints,
source observation/acquisition/publication/extraction timestamps and method
version/status. The original locator and permitted supporting quote survive.

Two Claims sharing a target are only potential comparisons. The rules run in
this order:

| Rule | Condition                                                                                                     | Result                             |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| R1   | Different attribute, entity level or scope                                                                    | Not comparable                     |
| R2   | Invalid/unvalidated grounding, inactive method, inference, ambiguity, approximation or unsupported value/unit | Unresolved                         |
| R3   | Different capacity definitions or access qualifiers                                                           | Not comparable                     |
| R4   | Unknown definition for capacity/beds                                                                          | Unresolved                         |
| R5   | Explicit disjoint validity intervals                                                                          | Compatible                         |
| R6   | Explicit disjoint seasons                                                                                     | Compatible                         |
| R7   | Different seasonal context, including stated versus unknown                                                   | Unresolved                         |
| R8   | Same normalized value and comparison context                                                                  | Equivalent source assertions       |
| R9   | Different allowed recreation facilities                                                                       | Compatible: facilities may coexist |
| R10  | Different pool/hot-tub/sauna assertions with unknown access                                                   | Unresolved                         |
| R11  | Different exclusive values, matching context and fully bounded overlapping intervals                          | Conflicting                        |
| R12  | Different values without established overlap                                                                  | Unresolved                         |

A conflict is an incompatibility of assertions, not proof of which source is
correct. An equivalent assertion can have unknown real-world validity; it does
not establish current availability. Compare profiles only within one Candidate.
Every cross-Candidate pair is conditional, even when a matcher called the
Candidates likely duplicates. No automatic identity resolution occurs.

All real text/structured Claims target possible Offers. Provider, Operating
Location, shared-facility and image scopes remain distinguishable comparison
inputs, but cannot produce supported Offer profiles. This respects the existing
Group Rental Property glossary: property geography currently belongs to Offer;
this experiment does not invent canonical Operating Locations.

## Normalization and context

Reuse existing attribute value schemas. Area conversion supports hectares to
square meters exactly (0.2 ha = 2,000 m²), and sorts/deduplicates explicit
seasonal month sets. Other values must already conform to
the existing ontology. The component does not perform new free-text extraction.
Romanian/English synonyms already mapped to one attribute/value compare as
those normalized assertions, while their original quotations remain different.
No fuzzy numerical tolerance makes approximate quantities exact.

The register's `Număr locuri` field means **officially classified accommodation
places**, including when the text extractor rereads that field. It is not
silently equated with advertised maximum guests including extra beds. Legacy
`beds` fields mean beds, not persons. Unspecified capacity definitions remain
unknown. Event attendance is a separate attribute. Generic rooms, event capacity
and sleeping capacity are never converted into one another.

For example, Romanian source quotations **“16 locuri clasificate”** and
**“20 de persoane cu paturi suplimentare”** describe different capacity bases.
**“Piscina este închisă iarna”** qualifies availability and does not mean that no
pool exists. Existing seasonal text qualifiers are preserved verbatim; this
baseline abstains rather than guessing calendar months from them. Summer pool
images and winter closure text make different propositions. Image visibility
cannot establish ownership, access or an Offer facility.

## Time and independent state dimensions

- `observedAt` retains the source-snapshot observation convention of acquisition.
  For an official export this can be the dataset date, not an inspection date.
- `acquiredAt` is the original source artifact retrieval time.
- `sourcePublishedAt` is unknown when the retained source does not provide it.
- `extractedAt` is when the Claim was created.
- `validity.from` / `until` describe asserted real-world validity only. Intervals
  are half-open `[from, until)` in UTC. Null endpoints mean unknown, not infinity.
- The corpus pins `asOf`; `assessedAt` is separately stored at persistence time.

Acquisition and extraction times never fill unknown validity. Fully bounded
intervals establish overlap; partially known endpoints can establish separation
but cannot establish overlap. Unknown validity never proves that newer evidence
supersedes an older assertion. Renovations, changed policies, additions, removals
and temporary closures require explicit context, otherwise comparison abstains.

Each Candidate/attribute profile reports:

| Dimension     | States and interpretation                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- |
| Support       | Supported source assertion; conflicted; insufficient evidence; not applicable reserved       |
| Corroboration | None established; independent documented support; repeated/possibly correlated Evidence      |
| Temporal      | Historical; explicitly bounded current interval; future; unknown; mixed contexts             |
| Freshness     | Within experimental review window; stale source observation; uncertain current applicability |

Historical support may also be independently corroborated. A fresh retrieval is
not proof of current truth. The exploratory review window is 365 days from
source observation; it prioritizes review and does not invalidate assertions.
A supported profile lists distinct source-asserted values with all input Claim
IDs; it selects no canonical value. Compatible historical values may both remain.
No profile states “not applicable” from silence or property type: the value is
reserved because there is no explicit applicability evidence in this corpus.
Superseded extraction methods remain visible but do not support conclusions.

## Independence and content lineage

A common-origin signal includes the same Evidence ID, original source record,
full source-content fingerprint, or exact long supporting passage fingerprint.
Repeated extraction from one Evidence item is one origin. Numeric cells and
short quotes are not cross-record passage fingerprints: two properties with
capacity 16 are not thereby copies. Exact hashes establish repeated retained
content, not authorship or independent truth.

The comparison contract can retain explicit `common_origin`,
`possibly_common_origin` and `independent` relationships with rationale and
Evidence references. Hard common-origin signals override an independence
assertion. Conflicting relationships conservatively favor possible correlation.
A separate domain or source family never establishes independence.

No real reviewed independent-origin relationships currently exist. The CLI
therefore refuses imported lineage assertions and stores none in the real
corpus. Synthetic tests exercise independently documented confirmations without
pretending such confirmations have been acquired. A future reviewed lineage
import needs its own authority/annotation contract before these relationships
can influence stored real profiles.

Leakage blocking additionally joins existing same-property suggestions, identical
retained content, folded exact long descriptions and high token-Jaccard
similarity (at least 0.8) in a bounded descriptive subset. Near-text grouping is
**possible shared lineage**, not proof of copying, and never raises confidence.
A maximum of 2,000 descriptive records bounds its pairwise work. Similar views
of one image facility are not independent confirmations; no image observations
were generated in the existing experiment.
