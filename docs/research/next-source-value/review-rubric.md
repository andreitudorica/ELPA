# Independent review rubric and status

Version `grp-next-source@1`; matcher `grp-duplicate-matcher@1` is frozen.
The [key-only manifest](./data/review-manifest.json) contains 11 holdout records;
six development records are excluded. No independent human labels have been
provided. The implementer's development inspection is not ground truth.

## Private review materials

Run `incremental-report` as described in reproduction instructions. Under
`apps/api/.data/next-source/evaluation/` it writes:

- `holdout-review.csv`: source keys, neutral source/Candidate links and blank
  decisions, provenance and reviewer columns. No prediction strength or
  classification is shown.
- `evidence.private.json`: retained original source payloads, content checksums,
  observation times, artifact references, and extracted Claim values for the
  sampled and suggested baseline Candidates. Baseline retention redaction is
  already applied. Record keys locate the exact source object in the pinned
  artifact; the live explorer is only a supplemental reference.
- `prediction-key.private.json`: predictions and development/holdout allocation,
  withheld from reviewers until labels are locked.
- `incremental-report.json`: aggregate comparison, withheld while reviewing.

Do not commit, publicly publish, or send these private materials automatically.
Two human reviewers should receive separate copies of the blind sheet. Source
material is available locally and in Administrator-guarded Data Studio; no
authentication or acquisition permission is implied for external linked pages.

## Review decisions

For each holdout record inspect its source-native material and extracted Claims.
Search the whole baseline, not just suggested pairs; inspect source keys and
Evidence to find aliases, multiple certificates, multi-unit complexes, and
different Offers from one Provider. A shared business domain is not proof of
the same property. A small geographic offset is not automatically a different
property. A matching name alone is insufficient.

`discovery_decision`:

- `existing`: a baseline record represents the same physical property / Offer;
  list its source key(s), corroborating Evidence and exact locator.
- `new_in_scope`: no baseline counterpart was found after documented search,
  and explicit Evidence establishes whole-property rental for the research
  population. Unmatched, a cabin category, or a marketing photograph is not
  enough. Without permitted supporting material choose `cannot_determine`.
- `out_of_scope`: evidence supports a rubric-v1 exclusion; record why.
- `cannot_determine`: novelty, identity, or eligibility cannot be established.

`pair_decision`: `same_property`, `same_provider_only`, `different`, or
`cannot_determine`. Record the specific counterpart source key; do not confuse
being somewhere in the baseline with correctness of a particular suggested pair.
Use the [existing population rubric](../group-rental-property-baseline/population-definition.md).
Operating Location is not used for this Category; review the physical property
and independently bookable Offer instead.

For attributes use `already_supported`, `new_explicit`, `uncertain_inference`,
`contradictory`, or `unknown`. Compare each distinct target/value against all
Evidence for the matched property, documenting exact source fields/passages.
Do not count copied statements or repeated identical values as new facts.
Do not infer whole-rental or private-event permission from categories, names,
photos, a gazebo, or generic team-building marketing. No candidate eligibility
is changed by these review files.

Every completed discovery label needs `reviewer_id`,
`reviewer_type=independent_human`, ISO `reviewed_at`, `evidence_urls`, and
`evidence_locator`. Keep developer and AI observations explicitly labelled with
their respective reviewer types. Empty rows are pending, never negative labels.

## Agreement, scoring, and limits

`incremental-score` validates that every labelled identity belongs to the frozen
holdout, refuses duplicate labels by one reviewer, and excludes developer/AI
labels. Headline discovery precision requires two concordant human decisions.
Single-reviewer and disputed rows are reported separately; `cannot_determine`
rows are unresolved. A third reviewer may document adjudication in a separate
sheet, but v1 does not automatically ingest adjudication: preserve disagreement
counts and reissue a versioned scoring procedure before using it in a headline.

The scorer uses the existing Wilson 95% interval and Cohen's kappa helpers.
Reported proportions are unweighted reviewed-sample metrics; no national or
six-county population yield is extrapolated. Source strata are disproportionate,
the effective frame has only 19 records, and only one holdout record is an
apparent discovery. A useful precise discovery estimate is therefore unlikely.

Record-level `existing` precision is not pair precision or false-merge rate.
Pair and attribute decisions are retained for independent inspection but are
not automatically scored by this v1 tool. Report those metrics as unmeasured
until a pair/attribute review is actually completed and a reviewed scorer is
provided. With no labels, point estimates, intervals, recall and kappa stay null;
zero confirmed rows is not a zero-population yield estimate.
