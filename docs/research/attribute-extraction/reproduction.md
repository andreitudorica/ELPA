# Reproduction

Use pinned Node/pnpm from the repository and the existing local PostgreSQL
configuration. Never print `.env.local`. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api build
```

Migration `0003_fast_iron_monger.sql` was generated, reviewed and applied locally.
It adds the `extract` stage and observation fingerprint to Claim uniqueness;
earlier migrations were not modified. Stop API watch while building, because
both build and watch write `dist`.

## Input prerequisites

The isolated source-experiment campaign must already contain the reproduced
register, OSM and bounded Overture imports and current matcher suggestions. Use
the [previous reproduction instructions](../next-source-value/reproduction.md)
to create it from the private pinned artifacts. This experiment does not fetch
new sources. The campaign used here is `01a15d8d-edc4-7a6d-bc18-26af6cccfdf3`.

The manifest pins the register checksum `d4854cff79bc…`, OSM `9eff756d49a9…`,
and Overture sample `c71f14ddf061…` with full checksums and source versions.
Global UUIDs may differ on a freshly imported database; source identities,
text fingerprints, selected groups and partitions remain reproducible. A
complete corpus checksum also covers local Evidence/Candidate identifiers;
compare key-only source selections when reproducing in a different database.

## Seal and run

Run once into a new private directory; an existing `sample.lock` deliberately
prevents silently redrawing the sample. If acquisition changes, use a new corpus
version/protocol rather than replacing failures with convenient examples.

```sh
pnpm --filter @elpa/api research extraction-corpus \
  --campaign 01a15d8d-edc4-7a6d-bc18-26af6cccfdf3 \
  --out .data/extraction/corpus-v1
pnpm --filter @elpa/api research extraction-run \
  --campaign 01a15d8d-edc4-7a6d-bc18-26af6cccfdf3 \
  --sample .data/extraction/corpus-v1
pnpm --filter @elpa/api research extraction-report \
  --sample .data/extraction/corpus-v1
pnpm --filter @elpa/api research extraction-score \
  --sample .data/extraction/corpus-v1
```

Expected here: frame 42,878; groups 34,362; sample 48 (24/24); current `grp-text-rules@2` facts 22;
first pass of this version creates 22 Claims, repeat creates zero; all three output digests
match [the execution snapshot](./data/execution.json). The earlier v1 run created 25 historical Claims; the current method adds 22
versioned Claims, giving 47 stored extraction Claims but only 22 current
observations. Archived per-method outputs live in `runs/<method>/`; do not sum
versions as distinct facts. There are no new Evidence
or Candidate rows. There are three new extraction Acquisition Runs per pass and
one started/completed actor-attributed Audit pair for each. Existing immutable
source content is checked against the sealed corpus before persistence. Corpus
files and source passages remain under ignored `apps/api/.data/`.

The scorer without labels reports `independent_ground_truth_incomplete`, zero
scored cells, zero technical grounding failures and `ai=not_executed`. Full
per-attribute metrics and the comparison are written privately. No labels means
null semantic accuracy, not perfect performance.

For independent labels, follow the [annotation guide](./annotation-guide.md),
then run:

```sh
pnpm --filter @elpa/api research extraction-score \
  --sample .data/extraction/corpus-v1 \
  --labels .data/extraction/reviewer-a.json \
  --labels .data/extraction/reviewer-b.json \
  --labels .data/extraction/adjudication.json
```

Omit adjudication when there are no disagreements. JSON schemas are exported
with the private pack. Unreviewed template values intentionally fail validation;
they cannot accidentally become ground truth.

## Optional authorized AI capture

The exported `ai-protocol.json` includes a fixed prompt/hash, ontology, strict
output schema and capture schema. A separately authorized operator can run an
approved model on the same permitted primary fields, recording provider/model
version, prompt version/hash, parameters, authorization and transfer references,
execution time, per-document latency, token counts and actual fees (or null).
This repository provides no live provider client or credential-loading path.

```sh
pnpm --filter @elpa/api research extraction-ai-import \
  --sample .data/extraction/corpus-v1 \
  --artifact .data/extraction/authorized-ai-capture.json
pnpm --filter @elpa/api research extraction-score \
  --sample .data/extraction/corpus-v1 \
  --artifact .data/extraction/authorized-ai-capture.json \
  --labels .data/extraction/reviewer-a.json \
  --labels .data/extraction/reviewer-b.json
```

Malformed outputs, duplicates, unknown documents, invalid versions and invented
spans are quarantined; they do not become Claims. Rejected/missing outputs stay
visible in validity/coverage metrics. No self-reported model confidence is used.
The same holdout corpus/labels feed both methods, with additional correct-fact
counts, observed AI cost, latency and cost per additional correct fact only when
those denominators exist. The whole captured-run fee is conservatively charged
against additional holdout facts; development costs are not silently removed.
Fresh live captures and offline captures are explicitly distinguished.

## Data Studio and checks

```sh
pnpm validate
pnpm db:check
pnpm openapi:generate
pnpm --filter @elpa/web exec playwright test --project=chromium
pnpm dev
```

Open `http://localhost:5273/studio/research-campaigns/01a15d8d-edc4-7a6d-bc18-26af6cccfdf3/candidates/01a15d90-e835-7c3a-8a2e-6848d741b9de`
for a development example. Candidate detail shows proposed pool/hot-tub Claims,
original source passages, field selectors, source/method versions, ambiguity,
temporal qualification and the independent-review warning. The source Evidence
link jumps to the retained snapshot. Other differing current values are flagged;
historical extraction Claims remain inspectable. These are existing admin
routes, never public projections.

CI uses synthetic fixtures only and never makes external model calls. API tests
exercise rules, strict validation, sampling, independent review/scoring,
contradictions, repeated processing, version changes, and persistence/Audit
sequencing through explicit collaborators. Real local repeat/constraint/audit
checks supplement them; there is still no CI PostgreSQL integration harness.
Regenerate OpenAPI/client together and verify generator idempotence. Do not
publish raw artifacts, private packs, annotation sheets or model captures.
