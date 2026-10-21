# Evidence-grounded visual property intelligence

**Decision: investigate further.** A working three-image acquisition, integrity,
Research persistence, review/export and captured-vision harness exists. Useful
visual extraction has **not** been demonstrated: there are no independent image
annotations, approved external model run, detection scores or validated attribute
gains. No visual capability is recommended for production automation.

Read the [frozen protocol](./protocol.md), [observed results](./results.md),
[image permissions](./permissions.md), [annotation guide](./annotation-guide.md)
and [reproduction instructions](./reproduction.md). Public files in `data/` are
aggregates, machine-readable definitions and key-only fingerprints. Original
photographs, captions, author metadata and review sheets remain in ignored
`apps/api/.data/visual/`.

The [validation record](./validation.md) distinguishes synthetic tests, real
acquisition/replay checks, live Studio inspection and the unexecuted independent
semantic evaluation.

## Observed starting point

The original national acquisition campaign has **42,861 source-keyed Candidates
and 468,223 proposed Claims**. The isolated source-expansion campaign has
**42,878 Candidates and 468,502 historical proposed Claims**, including the text
extraction experiments. These are not independently counted eligible properties.
The three property source families remain the official accommodation register,
Romania OSM extract and bounded Overture sample. Initial source coverage and
field completeness are reported in the
[acquisition baseline](../group-rental-property-baseline/README.md) and
[source-expansion report](../next-source-value/README.md).

At inspection, the text experiment really had a 25-attribute ontology, 48 primary
field documents (24 development/24 holdout), a working deterministic extractor,
grounding checks, proposed Claims, scoring/export and Studio inspection. Its
current rule version produced 22 proposed observations; earlier outputs survive.
**Independent entity-resolution and text semantic accuracy remain unmeasured.**
The mission's assumption that these evaluations were completed is not satisfied.
This experiment does not silently promote their output to ground truth.

Catalog implements Categories. Curation and Recommendation have no implemented
verification/publication workflow for these properties. Research retains immutable
Evidence and proposed Claims; database constraints still require `unverified`
Candidates and `proposed` Claims. Audit remains append-only and actor-attributed.
The pre-change tests passed: 41 API and 11 web tests.

No retained image Evidence, image decoder, visual annotations or vision provider
existed. The OSM Candidates exposed 44 `image` tags and nine Commons references.
Six Commons references were categories; three identified individual photographs.
Three of the 44 image URLs were those same Commons files; 41 pointed elsewhere.
The bounded experiment takes the census of the three direct file references.
It does not open categories, expand galleries or crawl the other hosts.

## Implemented boundary

`src/research/visual/` holds the observability vocabulary, bounded Commons adapter,
Sharp integrity processing, property-group split, permission/schema/span checks,
captured-model adapter and evaluation logic. `VisualService` orchestrates CLI
commands and transactional Research/Audit writes through existing repositories.

`wikimedia_commons_images` is an **Evidence source**, not a new Candidate source.
Migration 0004 widens only artifact/run/Evidence source checks and adds per-file
licence terms. Candidate source and curation checks remain unchanged. Each image
is a Source Artifact; its immutable Evidence contains original identity, licence,
dimensions, capture/upload/retrieval versions, original/preview hashes and the
explicitly unreviewed source relationship. Run records associate it with an
existing Candidate and record its parent textual Evidence. Import never changes
the Candidate's latest primary Evidence or creates a Candidate.

Original bytes and metadata-stripped PNG previews are private filesystem
attachments addressed by SHA-256; PostgreSQL remains authoritative for their
identity, permissions and associations. The CLI verifies retained fingerprints.
There is no media service, queue, vector store, model SDK or new runtime.

The optional structured capture importer requires recorded operator/transfer
authorization and privacy review of each preview. It validates model/prompt
versions, Evidence/hash identity, normalized regions, exact context spans and
strict output schema. Unsupported property attribution is quarantined. Accepted
observations can only propose `image.visible.<feature>` Claims; `not_visible`
never becomes a negative property Claim. Model/prompt/parameter fingerprints
separate reprocessing versions. Identical pinned reprocessing reuses Claims.
Confidence is stored as zero by convention, never a calibrated probability.

Studio renders local authorized previews, source/credit/licence, uncertain
association, image observations/regions, model versions and proposed text Claims.
The preview endpoint is under the existing Administrator guard, checks the exact
campaign/Candidate/Evidence association, validates the stored payload and preview
checksum, and returns private/no-store PNG bytes. It never fetches an arbitrary
URL supplied by a request. No public image route or publication action was added.

## What can advance

- File integrity and exact-content reuse work and can support further research.
  dHash groups are conservative leakage protection, not proof of property identity.
- Pool, gazebo, barbecue, lawn, outdoor seating, trampoline, sports court,
  table tennis and parking remain **unmeasured image-level hypotheses**. Every
  property attribution still requires separate supporting context and review.
- Event/music permission, legal capacity, measured yard area, boundaries,
  exclusivity, present operation and seasonal availability must not be inferred.
- Progress requires independent reviewers, adequate licensed positive/negative
  conditions and an explicitly approved model/transfer budget. A larger rights
  cleared sample requires a new protocol; this task does not acquire it.

A negative or inconclusive result is useful. The operational pipeline succeeds;
the commercial case for visual extraction remains unproven.
