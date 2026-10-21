# Visual property intelligence experiment v1

Frozen before image acquisition or model evaluation on 2026-10-21.
Corpus: `grp-visual-corpus@1`; seed: `elpa-visual-primary-2026-10`.

## Scope and sampling frame

Use existing latest OSM Evidence in the isolated acquisition campaign. Audit all
image-related fields, but acquire only direct `wikimedia_commons=File:` references
with independently retrievable per-file licence metadata. The observed frame has
three such references. Take their census, without substituting other images for
failures. Exclude six category references (not specific images), other image
hosts, brand/Wikidata images and all unlicensed or missing files. Do not crawl
galleries, categories, owner websites or nationwide imagery.

Use the Commons Imageinfo API with an identified user agent, bounded requests,
original file hashes and a strict CC BY-SA 4.0 licence allowlist. Preserve source
metadata, original bytes and source-to-Candidate association privately. A source
link is evidence of association, not a verified ownership/availability decision.
No public image distribution or third-party model request is authorized by this
experiment. Separate copyright permission, privacy screening and model/budget
authorization; never treat one as a substitute for the others.

This very small source-linked census is not a representative property sample.
It is expected to have severe geography, photographer, age and facility bias.
The protocol does not claim that difficult negative cases exist in this frame.
Missing conditions, including public pools, stock images, renderings, neighbors,
shared facilities, occlusion, night scenes and multiple views, must be reported.
Synthetic fixtures test handling of these cases but are not real evaluation data.

## Split and integrity

Before any semantic inspection, group existing same-property suggestions of
both tiers transitively, exact image hashes and near-duplicate dHashes at
Hamming distance <=6. Preserve each source identity when grouping. Similarity
groups are leakage protection, never property merges or proof of common ownership.
Use EXIF-oriented grayscale 9x8 pixels for the versioned 64-bit dHash. Enforce
file-byte/pixel limits, JPEG/PNG/WebP only, full decode, one frame, and strip
metadata from private PNG previews. Reject invalid images with explicit reasons.

Rank related groups by seeded hash of their stable source identities; reserve
the first ceil(groups/3) for development and the remainder for holdout. If fewer
than two groups survive, no independent holdout result is possible. All images
of the same property/content group stay together. Do not use holdout visual
content, captions or annotations to tune prompts. File licensing and integrity
checks are not semantic inspection. Any future tuning from holdout cases needs
a new untouched corpus version.

## Hypotheses and measurements

- H1: a fixed structured vision method identifies clearly visible features.
  Report per-feature held-out precision/recall and difficult-negative errors.
  Fewer than 20 independent positive and 20 negative examples per feature is
  insufficient for a promotion decision, regardless of point estimates.
- H2: correct image detections can be associated with the expected property.
  Measure attribution separately; any wrong-property assertion blocks promotion
  of an attribution rule. A category, source tag or filename alone never verifies
  ownership, guest access, present operation or facility exclusivity.
- H3: images add independently confirmed attributes beyond existing text.
  Compare against current text Claims, distinguishing proposed from independently
  supported text. Count distinct Candidate/attribute facts, not photos or views.
  Seasonal pool closure and a summer pool photograph are compatible evidence.

The non-AI semantic baseline uses existing text only and makes no new visual
observations. Deterministic image integrity detects no semantic facilities.
No numeric yard measurements, event permissions, music permissions, legal
capacities or current availability may be inferred from photographs.

## Annotation, model access and decision

Prepare blind, versioned annotation sheets for two independent humans and a
separate adjudicator. Record visible feature, region, visibility, scene type,
property association, attribution, occlusion, uncertainty and date limitations.
Developer or model labels cannot substitute for independent human ground truth.

Use at most one authorized structured vision method, with fixed model/prompt
versions and actual cost/latency records. A captured-output import/scoring
boundary is acceptable when model authorization is unavailable. Check privacy
screening and transfer permission before eligibility; never send unnecessary
faces or registration plates to a provider. No live call is made by default.

Image observations target `image.visible.<feature>` and stay proposed Research
Claims. They never become `offer.<attribute>` assertions automatically. Existing
text Claims, Evidence and canonical data are never overwritten. Use current
Research artifacts, Evidence, runs, Claims, Audit and admin inspection; add no
media service, vector store, queue or GPU infrastructure.

Without sufficient licensed images, independent labels or authorized model
execution, report metrics as unmeasured and decide **investigate further**.
Technical acquisition success is not proof of useful visual intelligence.
