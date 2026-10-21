# Observed result and investment decision

## Decision

**Investigate further.** The experiment proves bounded, licensed image retention,
lineage, integrity checks, replay and inspection. It does **not** establish
reliable visual detection, property attribution, incremental attribute value or
cost per useful fact. There are zero completed independent annotations and no
authorized external vision-model execution. H1, H2 and H3 remain untested.

No visual feature should advance to automated property assertions. Reviewers may
use authorized images as additional historical Evidence while preserving their
limits. Any production decision needs independently labeled difficult cases,
explicit transfer/privacy/model authorization and an adequate untouched sample.
This is an inconclusive semantic experiment, not a demonstrated AI success.

## Actual corpus

The frozen frame was the three direct Commons File references in latest OSM
Evidence in the isolated source-expansion campaign. All three passed explicit
CC BY-SA 4.0 licence/credit checks, source SHA-1/size checks and full image decode.
There were no failed image acquisitions and no substituted records. Six category
references and 41 other-host image tags were excluded. The three Commons image
URLs among the original 44 image tags overlap the selected references.

All three images are 2048 × 1536 JPEGs linked to guesthouse Candidates in
**Caraș-Severin (RO-CS)**. Their source capture metadata dates to May 2018;
upload versions date to April/May 2023. They do not establish present facilities
or Group Rental Property eligibility. Urban/rural and scene/difficulty strata
have not been independently annotated. No additional counties, property types,
night scenes, public pools, shared facilities, stock images, renderings or
occluded examples were manufactured to fill those gaps.

The seeded group split produced one development image and two holdout images,
three groups, no exact duplicate pairs and no near-duplicate pairs at the fixed
dHash distance ≤6. Existing matcher suggestions of both tiers protected against
cross-property leakage; they were not treated as verified entity identity.
Only the development preview was opened for engineering inspection. Holdout
visual content was not used to tune extraction instructions. This source-linked
census has severe selection bias and supplies no national market denominator.

The key-only [manifest](./data/manifest.json) binds image/source versions, groups,
split and complete entry digests, including Candidate and parent-Evidence lineage.
An explicit metadata amendment corrected an initial exclusion label (`44` counted
all image tags; other-host tags are `41`) and added complete entry digests.
The prior manifest/corpus remain private. No source image, selection, split,
Evidence or annotation was changed. Both fingerprints and the amendment rationale
are retained; this was not a new or replacement sample.

## Before and after

Observed counts are from local PostgreSQL, not national property estimates.

| Dimension                                      |     Before | After acquisition + replay |                     Change |
| ---------------------------------------------- | ---------: | -------------------------: | -------------------------: |
| Original national campaign Candidates          |     42,861 |                     42,861 |                          0 |
| Original national campaign proposed Claims     |    468,223 |                    468,223 |                          0 |
| Isolated experiment Candidates                 |     42,878 |                     42,878 |                          0 |
| Isolated experiment historical proposed Claims |    468,502 |                    468,502 |                          0 |
| Retained image artifacts / image Evidence      |      0 / 0 |                      3 / 3 |                    +3 / +3 |
| Authorized images with source association      |          0 |                          3 | +3 unreviewed associations |
| Visual proposed Claims                         |          0 |                          0 |      0; model not executed |
| Independently reviewed image labels            |          0 |                          0 |                          0 |
| Verified Candidates / published property facts |      0 / 0 |                      0 / 0 |                          0 |
| Independently validated new attributes         | Unmeasured |                 Unmeasured |                 Unmeasured |

The text-only comparator contains **22 current proposed text-backed Claims** on
these three Candidates; the aggregate count is exported by the scorer. It is not an
independently validated semantic baseline. There is no measured text/vision
agreement, contradiction rate or completeness gain. The harness distinguishes
these outcomes and deduplicates reviewed gains by Candidate/feature rather than
counting repeated images. It retains possible conflicts and never overwrites text.

## Quality and uncertainty

| Feature            | Independent holdout labels | Precision / recall / F1 | Attribution / incremental gain |
| ------------------ | -------------------------: | ----------------------- | ------------------------------ |
| Pool               |                          0 | Unmeasured              | Unmeasured                     |
| Gazebo / pavilion  |                          0 | Unmeasured              | Unmeasured                     |
| Barbecue structure |                          0 | Unmeasured              | Unmeasured                     |
| Lawn               |                          0 | Unmeasured              | Unmeasured                     |
| Outdoor seating    |                          0 | Unmeasured              | Unmeasured                     |
| Trampoline         |                          0 | Unmeasured              | Unmeasured                     |
| Sports court       |                          0 | Unmeasured              | Unmeasured                     |
| Table tennis       |                          0 | Unmeasured              | Unmeasured                     |
| Parking area       |                          0 | Unmeasured              | Unmeasured                     |

False-positive/negative rates, abstention, difficult-case performance,
wrong-property attribution, shared-facility ambiguity and reviewer agreement are
also unmeasured. Confidence intervals are null when there are no eligible trials;
zero labels is not zero error. Even complete annotation of two holdout images
would fall far below the frozen minimum for a feature investment decision.
Synthetic tests prove rejection and arithmetic behavior, not real-world quality.

`quality-report.json` exposes per-feature denominators, Wilson intervals,
disagreements, grounding failures, attribution, proposed-text comparison and
missing costs. The source and Claim schemas separate image visibility from
property ownership and availability. The capture adapter rejects unsupported
`belongs_to_candidate` assertions; a correct pool detection cannot bypass this
check. Region/context validity does not establish semantic support.

## Economics and operational failures

Observed initial acquisition/integrity/Research persistence time was
**3,183.15 ms** for three images. The per-image portions were approximately
874.15, 771.06 and 894.73 ms. Original storage was **768,909 bytes**; private
preview storage is recorded in the aggregate economics artifact. HTTP and local
processing/SQL time were not separately instrumented; these figures are one
small local run, not projected throughput.

| Resource                                       | Observed                     | Production projection                        |
| ---------------------------------------------- | ---------------------------- | -------------------------------------------- |
| Successful / failed image acquisitions         | 3 / 0                        | Unknown                                      |
| Processing failure rate                        | 0/3 observed; tiny sample    | Unknown                                      |
| Exact / near-duplicate pairs                   | 0 / 0                        | Unknown                                      |
| Paid acquisition/download fee                  | EUR 0 observed               | Licence/access must be reassessed per source |
| Vision calls, tokens, model charges            | 0 calls; no model usage      | No approved model/budget                     |
| Compute/storage/network cost                   | Not monetized                | Unknown                                      |
| Engineering and human review cost              | Not time-billed or monetized | Requires measured review effort              |
| Cost per independently supported new attribute | Undefined                    | No validated gain/cost basis                 |

The final validation replay reuses all three artifacts/Evidence rows, creates no
Candidates/Claims, makes no network calls, and appends new actor-attributed run
history. The number of replay runs is operational history, not corpus size or
attribute gain. Initial local database access was sandbox-restricted; it was
rerun with authorized access. Those preflight failures were not failed source
records. Failed future image acquisitions are logged without substitution;
metadata acquisition failures preserve the sealed frame and fail explicitly.

The implementation adds a narrow decoder/hash dependency and one bounded source
adapter. Maintenance risks include Commons metadata/licence drift, native image
decoder updates, attachment loss, old image dates, unreviewed source links,
perceptual-hash false grouping and human attribution effort. There is no measured
case for scaling model usage or image acquisition.

## Evidence that would change the decision

Two independent human reviews and documented adjudication, enough separately
licensed positive/negative examples for each target feature, correct attribution
in difficult cases, an approved fixed vision method on untouched inputs, and
observed incremental **distinct supported** attributes at acceptable review and
processing cost. Event/music permission, legal capacities, numeric yard area,
boundaries, exclusivity and present availability remain outside visual inference.
