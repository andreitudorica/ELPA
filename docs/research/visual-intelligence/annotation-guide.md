# Independent visual annotation protocol v1

No completed independent annotations are included in this experiment. The
private template intentionally contains null fields and **fails** the completed
annotation schema. It cannot be submitted as a successful review.

Use `annotation-template.private.json`, `annotation-schema.json`, the original
images/private previews, `corpus.private.json`, source pages and
`observability.json`. Retain the corpus manifest fingerprint on every sheet.
Do not commit completed or blank per-image review sheets to the public repository.

## Independent procedure

1. Two independent human reviewers work separately, without model predictions,
   proposed visual Claims or each other's decisions. They record their identities,
   time and independent-completion attestation. Developer/AI decisions are not
   accepted as independent human ground truth. Both review all holdout images in
   this tiny corpus. Do not tune from their holdout findings.
2. Inspect the oriented original for detail and the permitted source context.
   Source tags and filenames alone cannot establish property attribution.
3. For each image, identify whether it depicts the expected property (`yes`,
   `no`, `unknown`) and whether it is a photograph, possible rendering,
   stock/promotional or unknown scene. Flag nearby attraction, stock, rendering,
   neighbor, shared, old, wide-angle, occluded, night and low-quality conditions.
   An empty condition list means no flagged condition, not proof of freshness.
4. Fill exactly one cell for each of the nine features. Label visibility as
   `clear`, `partial`, `not_visible` or `uncertain`. `Not_visible` concerns this
   image only. Preserve ambiguity rather than guessing absent/present property
   facilities. A region is optional `[x,y,width,height]` normalized to the
   oriented image; it must stay inside image bounds.
5. Label attribution separately: `belongs_to_candidate`, `nearby`, `shared`,
   `unrelated` or `unknown`. For `belongs_to_candidate`, supply a specific
   independently reviewed source passage/reference establishing the relationship.
   Presence in a gallery or a correct pool detection is insufficient. Explicitly
   retain `not_established_by_photo` for current availability.
6. Compare sheets only after completion. Record disagreements and their reasons.
   An independent adjudicator records original decisions, cited context, final
   decision and rationale in a private versioned adjudication record. Produce
   revised signed sheets referencing that record; preserve originals. The scorer
   excludes conflicting cells until reviewers submit an agreed revision. It does
   not invent adjudication from a majority vote.

The schema validates structure and references, not reviewer independence or the
semantic validity of a passage. Those remain auditable human responsibilities.
Different source pictures of the same facility count as separate image tasks but
only one Candidate/attribute gain. Similar-looking facilities are never merged.

## Scoring conventions

Only double-reviewed, agreeing holdout cells enter measurement. Development
results never enter reported quality. Clear predictions are positive; explicit
`not_visible` is a negative image prediction; partial, uncertain, missing or
quarantined results abstain. Abstentions on clear positives count as missed facts.
Negative gold cells without a positive prediction count as true negatives, with
abstentions also reported separately. Ambiguous gold cells do not enter binary
precision/recall; unsupported clear predictions on them are reported separately.

Per-feature precision/recall/F1, false-positive/negative rates, abstention,
unsupported clear observations and difficult-case support are separate from
context attribution. Wilson 95% intervals describe observed cell proportions;
they are not national estimates and do not correct tiny or correlated samples.
Kappa uses the first two original sheets on shared holdout cells. Disagreements
and missing coverage are retained. Review revisions need their own report.

Compare visual detections with current proposed text using reviewed attribution:
consistent with proposed text, new observation pending review, potential conflict,
uncertain observation, irrelevant or unattributable. These proposed text Claims
are not independently supported truth. A summer pool image and winter closure
are compatible; a lawn patch and sloped terrain need not conflict. Never infer
permission, exclusivity or current operation from either example.

Only clearly detected features independently attributed to a real scene of the
expected property, absent from existing text, may count as a reviewed incremental
attribute. The metric does not publish a property Claim. The adapter itself keeps
attribution unverified and refuses model assertions of property ownership.

No feature can be recommended for automation from two holdout images. The frozen
minimum of 20 positive and 20 negative independent examples per feature is only
a prerequisite for a later decision, not an automatic promotion threshold.
