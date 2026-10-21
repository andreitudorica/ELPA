# Reproduce the bounded visual experiment

Use the repository-pinned toolchain and follow the existing
[acquisition](../group-rental-property-baseline/reproduction.md) and
[text extraction](../attribute-extraction/README.md) prerequisites. The real
experiment requires the imported isolated campaign and its private artifacts.
Synthetic tests run without PostgreSQL, private images, credentials or a model.
Never print local environment values or commit `.data/`.

## Build and schema

Stop API watch mode before builds or OpenAPI generation; both use `dist/`.
From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api validate
pnpm --filter @elpa/web validate
pnpm db:check
pnpm openapi:generate
```

Migration 0004 adds the image Evidence source/per-file licence allowance, not a
media table or a verification path. `sharp` is pinned; use the same lockfile and
processing version for reproducible previews/dHashes. Decoder upgrades require
reviewed fingerprint changes and a new processing version.

## Existing pinned local corpus

Commands below run from the repository root with API workspace cwd through pnpm:

```sh
pnpm --filter @elpa/api research visual-replay --sample .data/visual/corpus-v1
pnpm --filter @elpa/api research visual-score --sample .data/visual/corpus-v1
```

Replay expects three unchanged image Evidence identities, no network calls,
no new Candidates/Claims and new audited run history. Score with no labels/model
expects `incomplete_independent_annotation`, `not_executed`, zero scored cells,
null quality/gain/cost metrics and `investigate_further`. It refreshes the blank
annotation template/schema and fixed capture protocol; it does not produce labels.

The manifest fingerprint is
`e19e8ecf092bac7b35a276fdfa7066dd1914e99baeaf5dc9aa0593d443aa7a55`.
The metadata amendment retains the original
`eebe32fa9c5638ab67799b24b73a0380749cbec5b53fbc3df66fb074132b1fec`
and rationale. All original image SHA-256 values and property-disjoint splits
are unchanged. `readVisualCorpus` validates the selection/entry fingerprints,
private original/preview bytes and partition boundaries before scoring/replay.

Private files include original Commons response, source frame, corpus, blank
annotation sheet, captured outputs if later authorized, and image attachments
in `.data/visual/images/<sha256>.original` / `<sha256>.preview.png`.
PostgreSQL stores immutable image Evidence, permissions and Candidate association.
Retain both the private pack and database for exact replay; a fresh database has
different entity ids and needs a new local acquisition pack.

## One-time acquisition on an imported baseline

Use the same three-file sampling frame. Pick a new output directory; an existing
`sample.lock` intentionally prevents resampling or silently replacing failures.
Do not delete a lock to hide a failed attempt. Preserve its failures and establish
a separately named, documented attempt if acquisition must be retried.

```sh
pnpm --filter @elpa/api research visual-corpus \
  --campaign 01a15d8d-edc4-7a6d-bc18-26af6cccfdf3 \
  --out .data/visual/new-local-attempt
```

Expected source image fingerprints are in the public key-only manifest. Local
UUIDs, retrieval time, licence-check time and therefore entry/manifest hashes
change for a new acquisition. Changed images/licences, missing files and source
drift must be reported, not replaced. Exact historical reproduction uses retained
originals; do not claim it if those inputs are unavailable. All network requests
are bounded to the Commons API and approved original image host. There is no
general URL/image crawler.

## Independent review and optional captured vision

Give reviewers the original images, private context, observability spec and
[guide](./annotation-guide.md), without predictions. They complete separate
versioned JSON sheets matching the exported schema. Retain disagreements and
adjudication privately. A template full of nulls is intentionally invalid.

```sh
pnpm --filter @elpa/api research visual-score \
  --sample .data/visual/corpus-v1 \
  --labels .data/visual/reviewer-a.private.json \
  --labels .data/visual/reviewer-b.private.json
```

No live model command or provider SDK exists. If a model and budget are later
approved, first review privacy and third-party rights for the exact preview,
then use `vision-protocol.json` with one fixed model/version/parameters. Record
operator/transfer authorization, privacy reviewer/hash, prompt hash/version,
actual token/cost/latency data and captured/fresh-live provenance. Unknown costs
are null. The capture schema is strict; no model self-confidence is accepted.
Images and captions are untrusted inputs, never instructions.

```sh
pnpm --filter @elpa/api research visual-ai-import \
  --sample .data/visual/corpus-v1 --artifact .data/visual/vision-capture.private.json
pnpm --filter @elpa/api research visual-score \
  --sample .data/visual/corpus-v1 \
  --labels .data/visual/reviewer-a.private.json \
  --labels .data/visual/reviewer-b.private.json \
  --artifact .data/visual/vision-capture.private.json
```

The import quarantines invalid schema/references/spans/regions, missing privacy
clearance and unsupported property attribution. It persists only accepted
image-level proposed Claims with method/version metadata and acting Administrator
Audit. Identical import repeats do not add Claims. New model/prompt parameters
create a new method fingerprint and preserve history. This has synthetic test
coverage; no real captured model outputs were invented for this experiment.

## Data Studio

```sh
pnpm dev
```

Open `http://localhost:5273/studio/research-campaigns`, select the isolated source
experiment, then an OSM Candidate keyed by `way/595512647` (development image).
Its Evidence section includes the authorized local preview, credit/licence,
source relationship, date context and pending-review warning. No visual Claims
are expected until an authorized capture is imported. Related proposed text
Claims stay visible. Preview requests use the Administrator-protected API and
never expose a public recommendation image.

The synthetic test suite covers malformed/oversized/corrupt input, orientation,
metadata stripping, exact/re-encoded images, conservative grouping, source
identity, rights gates, invalid Evidence/context/regions, unsupported attribution,
model-version identity, repeated proposed persistence/audit, conflicts/seasonality,
independent-review gaps/disagreement, guarded preview lookup and blob cleanup.
No deterministic test depends on live image or model services.
