# Property attribute extraction protocol v1

Frozen before corpus selection or extraction evaluation on 2026-10-21.
Version: `grp-text-corpus@1`; seed: `elpa-primary-text-2026-10`.

## Population and sampling

Use latest retained Evidence for the 42,878 source-keyed Candidates in the
isolated next-source campaign. Do not acquire linked websites. Include screened
out records as negative controls; screening is not eligibility ground truth.
Retain only an allowlist of original descriptive and structured attribute
fields, never names, contact details, addresses, or previously extracted Claims.
Exclude free-text fields containing email addresses, URLs, or telephone-like
sequences; record exclusions, without replacing an excluded field with invented
text. Preserve the Evidence checksum, source artifact checksum/version, field
path, original string, and a checksum of each retained text document privately.

Before splitting, connect all existing same-property suggestions (both tiers),
identical source identities, and identical normalized descriptive text of at
least 40 characters. Also connect descriptive texts with at least eight distinct
tokens and token-set Jaccard similarity >=0.8 (bounded to 2,000 descriptive
records; fail rather than silently skip this check). This refinement was fixed
before the first sample draw. Assign entire connected components by seeded hash to
development (approximately 30%) or holdout. This deliberately over-groups
possible matches to reduce leakage; unresolved matches and paraphrased copies
remain limitations, not independently established identities.

Within each partition, stratify by source family, urban/rural/unknown locality
classification, and content class (description >=200 characters, shorter
description, structured-only, empty). Rank component representatives by seeded
source-identity hash, take up to two distinct components per stratum. A component
can contribute only one sampled Candidate. Include empty documents as abstention
controls. No replacements after selection. Publish frame/stratum counts and
key-only selections. This is a purposive stratified experimental corpus, not a
representative national property sample. Diacritics, language, county and
facility density are descriptive coverage diagnostics, not additional claims
of representativeness. Missing ambiguity or conflict examples are reported as
gaps; synthetic tests do not fill real-corpus gaps.

## Hypotheses and endpoints

- H1: conservative deterministic extraction recovers explicitly supported
  numeric and facility facts. Reject for an attribute if independent holdout
  precision is below 0.95 or recall below 0.70. These thresholds are promotion
  gates, not results; fewer than 20 independently labeled positive examples
  leaves the attribute inconclusive regardless of its point estimate.
- H2: explicit event policies and scope can be extracted without inventing
  permission. Any unsupported permission Claim blocks promotion of that rule.
- H3: structured AI adds correct supported facts economically. Compare identical
  held-out inputs, report additional correct facts and unsupported Claims, and
  leave cost per additional fact undefined if there is no positive increment.
  No live model calls without an approved model, legal transfer basis and budget.

All source-grounding checks are technical checks, not semantic accuracy. No
accuracy, recall, semantic grounding, or economic-per-correct-fact result is
reported without independent human labels. Unknown is absence of evidence,
never a negative Claim. Corpus counts, extraction counts, execution time and
byte size are observed exploratory measurements. No population weighting or
national extrapolation is planned.

## Development and holdout

Inspect development texts only while changing rules. Holdout documents remain
available privately for annotation and frozen extraction/scoring. Do not tune
from holdout errors; tuning informed by holdout passages or semantic errors
requires a new untouched corpus version. Capture rule, ontology, projection, prompt, model, output and document
versions. Identical inputs and method versions must reproduce the same facts.

Amendment after technical v1 execution, before independent annotation: a
synthetic duration/price counterexample motivated `grp-text-rules@2`. No holdout
passage, semantic label or error informed this correction. The same still-blind
holdout is rerun; v1 outputs and proposed Claims are retained. These runs remain
exploratory, with no confirmatory quality claim. Tuning from holdout passages or
semantic errors still requires a new untouched corpus version.

## Review and decision

Two people independently annotate all attribute states for each reviewed
document, including exact spans, scope, ambiguity, temporality and conflicts.
An adjudicator resolves disagreements; single, disputed or incomplete labels
are excluded from headline metrics and counted. Reviewers declare human
identity and independence from extractor development. Developer and model
labels cannot constitute independent ground truth.

If no independent review or authorized model run is available, deliver the
working pipeline, private blind annotation pack, strict output importer and
null quality metrics. The investment decision remains **investigate further**;
successful execution is not proof of reliable property knowledge.
