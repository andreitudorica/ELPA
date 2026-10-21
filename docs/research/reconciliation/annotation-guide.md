# Independent review protocol

Independent evaluation is **incomplete**. There are no independent reviewers,
completed labels or adjudications. Synthetic tests and developer inspection are
not ground truth. Do not fill the private template with generated answers and
call it independent review.

## Sampling and separation

The frame uses existing Claims for 13 fixed attributes in the isolated
source-expansion campaign. All current and superseded methods are retained.
Group related Candidates and source lineage before sampling. A group never
spans development and holdout. Unreviewed identity suggestions are conservative
leakage blocks, not identity judgments. Undetected paraphrases or wrong/missed
matcher links remain leakage risks.

The initial 24-case preflight overrepresented register capacity. Its corpus and
assessments are retained. Sampling v2 was amended using source/attribute metadata
only, with no inspected holdout passages or human labels. It draws up to four
groups per `reprocessed/cross_candidate/single_source × source-family set ×
attribute set` bucket, ranked by SHA-256 of the fixed seed and stable group key.
Within each bucket, alternating ranked groups enter development/holdout. Stop
rather than exceed 48 cases. Groups over 100 relevant Candidates or 200 frame
Claims are explicitly excluded. Failures are not silently replaced. Reprocessed
means multiple Claim interpretations, not independent corroboration.

The sample is deliberately stratified, not representative of Romanian properties.
Rare source/attribute buckets may have only development examples. No unknown
field becomes a negative control label. Sources absent from the attribute frame
are recorded as absent, not artificially populated.

## Materials

`corpus.private.json` contains immutable Claim projections and allowlisted
original source fields, source URLs, versions, hashes and retention context.
`manifest.json` pins the entire corpus checksum. `review-template.private.json`
is blind: pair IDs are provided, predicted classifications are not.
`results.private.json` is a separate prediction artifact. Keep review sheets,
quotes and source rows private under `.data/`, as required by AGENTS.md.

Two independent human reviewers should label every holdout case separately.
They must not tune rules, inspect each other's labels or use model-generated
labels as their judgments. Reviewer identity is a declared protocol attestation;
the software cannot establish independence by itself. Original full artifacts
remain privately archived when source terms permit; allowlisted retained fields
are the earliest available source text for this evaluation. Request restricted
context through an Administrator when the projection is insufficient, and label
unresolved rather than guess.

## Pair decisions

Read the original fields and locator before comparing normalized values. Record
all Evidence IDs inspected and a written rationale for every case. For each
listed pair choose exactly one:

- **Equivalent:** same assertion after defensible normalization, matching entity
  scope and qualifiers. Do not equate room, bed, overnight or event capacities.
- **Compatible:** distinct assertions can coexist, such as independent recreation
  facilities or explicitly non-overlapping validity/season contexts.
- **Conflicting:** mutually exclusive assertions about the same scoped entity
  and context with established overlapping validity. Neither acquisition time
  nor the newest extractor proves overlap or resolves a conflict.
- **Not comparable:** different attributes, scopes, capacity definitions or
  facility-access propositions. A wrong-property association is not a conflict
  about one property.
- **Unresolved:** Evidence or identity/context is insufficient. Do not force a
  match or reinterpret ambiguous source material to make values agree.

Cross-Candidate pairs are hypothetical comparisons conditional on common
identity, not resolved property assertions. If original Evidence demonstrates
wrong identity, label not comparable and explain it. Otherwise retain identity
uncertainty even when the values agree. Different domains do not establish
independent origin. Marketing text and quoted copies count as one possible origin.

## Prediction inspection and adjudication

After blind pair annotation, inspect the retained predictions separately and
record case-level `scopeError`, `temporalError`, `lineageError`,
`unsupportedConclusion`, and `correctAbstention` (null if not applicable).
A technically valid passage does not guarantee its interpretation. Report
unsupported “current pool”, event permission, exact yard area or ownership
conclusions even when an object or keyword is present.

Each JSON review declares the corpus digest, distinct reviewer ID and
`reviewerKind: independent_human`. Every holdout case must include every pair
exactly once and every relevant Evidence ID. The scorer rejects unknown pairs,
missing Evidence references, wrong corpora and duplicate reviewer identities.
Unlabeled and single-reviewed cases remain unscored.

Agreement requires matching decisions and error judgments, not identical prose.
Disputed cases remain unscored until a third independent adjudicator records a
rationale, all disagreeing reviewer IDs and a complete decision in the
`adjudicationSchema` format. Inspect source material again; do not majority-vote
away ambiguity. Keep both reviews and the adjudication. The scorer reports
review counts, disagreement, adjudication and unresolved cases explicitly.

Metrics include one-versus-rest precision/recall and false-positive/missed rates
for every relation, both overall and per attribute; scope, temporal, lineage and
unsupported-conclusion error rates; and correct abstention. Wilson intervals
are descriptive only: pairs sharing a property are correlated. A small purposive
sample cannot support national performance estimates. Critical attributes with
no independent labels retain null metrics rather than favorable aggregate scores.
