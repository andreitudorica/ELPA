# Independent annotation protocol v1

Version: `grp-annotation@1`; ontology: `grp-attributes@1`. Annotation is **not
completed** in this experiment. Developer inspection and synthetic tests are
not independent ground truth.

## Blind primary pass

Give two different human reviewers private copies of
`annotation-template.private.json`, `corpus.private.json`, `ontology.json` and
this guide. Do not provide the extractor predictions or rule source during the
first pass. Each reviewer records their own identity and explicitly declares
human authorship and independence from developing/tuning the extractors. These
declarations are auditable attestations, not identity verification by software.

For every document, inspect all original retained fields. Source keys, Evidence
ids, source versions, artifact fingerprints and field paths identify the material.
Review the original Evidence in Administrator Data Studio when context is
unclear. Do not fetch other websites to supply facts missing from this corpus.

Replace each `unreviewed` cell with one of:

- `present`: an explicitly supported positive value; supply every distinct fact.
- `explicit_negative`: an explicit denial. Use boolean false or
  `parties_allowed=no` where the ontology permits it. Positive-only numeric/enum
  attributes can have no normalized negative fact; quote the denial and explain
  it in `rationale`. A missing gazebo alone cannot negate covered seating.
- `unknown`: no support in the supplied material; no facts.
- `not_applicable`: an evidenced applicability decision with rationale; no facts.
- `ambiguous`: scope, value or meaning cannot be resolved; explain rather than guess.

Each fact follows the strict schema in `ai-protocol.json`: attribute, normalized
value, document/Evidence/source-version references, text fingerprint, field path,
exact quote, start/end offsets, explicitness, entity level/scope, temporal
qualification and ambiguity. Offsets count **JavaScript UTF-16 code units**, start
inclusive/end exclusive, within the original individual field string. Unicode
normalization is not applied to stored quotes. A viewer can calculate offsets
with a text editor/JavaScript; the validator checks the exact slice.

Use the smallest complete supporting clause that preserves negation, ownership
and restrictions. Preserve an approximate quantity as such. Temporal kinds are
`unspecified`, `seasonal`, `year_round`, or `restricted`; non-unspecified facts
also quote the applicable temporal text inside the supporting span. Keep both
conflicting values and mark ambiguity `conflict`; list unresolved conflicts in
the cell. Different recreational facilities are separate facts, not conflicts.
Repeated identical propositions count once. A real negative claim is different
from silence, and source agreement is different from independent support.

The 25 attributes describe the **advertised accommodation Offer**, never the
operator's other properties or a nearby public facility. This does not resolve
the Candidate to a canonical Offer or Operating Location. Bedroom count is not
generic room count; overnight capacity is not event attendance; whole-property
rental requires explicit booking language; property type is insufficient.
Private-event permission requires an explicit policy. A pool's seasonal closure
does not establish that the property has no pool. A terrace without a roof
statement does not establish a gazebo. Marketing suitability is not permission.

## Claim-error pass

After the blind labels are sealed, give each reviewer
`prediction-review.private.json`. For each predicted `factId`, add a `judgments`
entry to the appropriate document:

```json
{
  "factId": "<supplied fingerprint>",
  "support": "supported",
  "valueCorrect": true,
  "normalizationCorrect": true,
  "scopeCorrect": true,
  "negationCorrect": true,
  "temporalCorrect": true,
  "notes": "<independent rationale>"
}
```

`support` can also be `unsupported` or `ambiguous`. Judge semantics, not merely
whether the quote exists. Record numeric/units errors separately from scope,
negation and temporal errors. Technical grounding is measured automatically;
these human judgments measure meaning. Negation/temporal accuracy denominators
are predicted negative/qualified Claims respectively, and do not measure recall
of missed negative or seasonal facts; the blind fact annotations supply recall.
To compare AI, export its accepted predictions in the same method-blind format
using `predictionId`; reviewers label the union without model identities.

## Double annotation, adjudication and scoring

Two independent reviewers are required for each scored document/attribute cell.
Incomplete files can omit unreviewed cells/documents; do not relabel them unknown
just to pass validation. Duplicate identities, schema/reference errors and duplicate
cells are rejected and reported. Single-reviewer, disputed and ambiguous cells
are counted but excluded from headline metrics. A third independent human,
`role=adjudicator`, resolves disagreements in a separate file after both reviews.
An adjudicator alone cannot substitute for double annotation.

The scorer matches distinct facts by document, attribute, normalized value,
explicitness-equivalent value, scope, temporal qualification and ambiguity, with
the same original field and overlapping supporting spans. It is deliberately
strict: alternate temporal wording or ambiguity labels can cause a mismatch;
review such cases as scorer limitations rather than silently tune on holdout.
Independent claim-error judgments supply semantic support, normalization, scope,
negation and temporal metrics; without those double-reviewed judgments those
metrics remain null. All metric denominators are reported.

Only holdout cells feed accuracy metrics. Cohen's kappa/disagreement counts cover
paired annotation cells; adjudication never erases the original disagreements.
Wilson 95% intervals describe sample proportions, with no adjustment for within-
document correlation and no national extrapolation. F1 has no interval here.
Do not promote any critical attribute from a handful of examples. The frozen
promotion gates and evidence requirements are in the protocol.
