# Reproduce the controlled source experiment

Use repository-pinned Node/pnpm, the existing Docker PostgreSQL, and the
sanitised configuration examples in the application READMEs. The API watch
process should be stopped while building: both commands write `dist/`. Start
the servers for inspection after builds and CLI commands complete.

## Pinned inputs and preparation

The two baseline artifacts and their manifests are listed in the
[baseline reproduction guide](../group-rental-property-baseline/reproduction.md).
Keep them privately under `apps/api/.data/artifacts/`; do not redownload a newer
register export and call it the pinned version.

The observed Overture frame is release `2026-09-23.1`, SHA-256
`9e08aedd8c590f9ce8f7690df461e590c0fec26eb3ce174fd802e5a3dbab5ddd`.
Its private frame and metadata live in `apps/api/.data/next-source/`.
The public [frame metadata](./data/frame-acquisition.json) records the query,
retrieval time, version and resources. The original export used the pinned
DuckDB 1.4.1 Python bindings in an isolated temporary tool environment; neither
Python nor DuckDB is an application dependency or an authoritative store.

For a fresh export of that same release, install the official **DuckDB CLI
v1.4.1**, then run from the repository root:

```sh
node docs/research/next-source-value/fetch-frame.mjs apps/api/.data/next-source-fresh
```

This runs the checked-in SQL through the documented anonymous S3 interface,
withholds email/phone columns, refuses to overwrite a pinned frame, and retains
failed commands rather than choosing replacements. It requires network access
to the official DuckDB extension registry and public Overture bucket. Internal
HTTP request counts are not measured. JSON serialization and retrieval times
can change file checksums; exact reproduction uses the archived frame and
metadata. The sampling algorithm hashes canonical JSON and source identities.

The same-release public URL may eventually expire. A missing snapshot is a
reproduction failure; do not silently substitute a later release. Make the
CDLA licence text available with any privately shared selected-source data.

## Build, sample, and isolate the comparison

```sh
pnpm db:up
pnpm db:migrate
pnpm --filter @elpa/api build

pnpm --filter @elpa/api research sample-overture \
  --frame .data/next-source/overture-ro-lodging-frame.json \
  --metadata .data/next-source/frame-acquisition.json \
  --out .data/next-source

pnpm --filter @elpa/api research next-source-campaign
```

Relative CLI paths are resolved inside `apps/api`. With the archived inputs,
sampling selects **17 records** (6 tuning, 11 evaluation) and writes:

- `c71f14ddf061-overture-sample.json` and its acquisition manifest;
- `sample-manifest.json`, containing keys, strata, exclusions and probabilities.

The sample checksum is
`c71f14ddf0612f15c5b2e890658624d5efa0690bc1554acd5a9eb6ae0428af60`.
Use the campaign id returned by `next-source-campaign` below. It finds the
isolated campaign by its fixed name on repeat; never substitute the original
national baseline or the earlier birthday test campaign.

```sh
pnpm --filter @elpa/api research import --campaign <id> \
  --artifact .data/artifacts/d4854cff79bc-Lista-structurilor-de-primire-turistice-cu-funcțiuni-de-cazare-clasificate-actualizată-la-21.10.2026.xlsx
pnpm --filter @elpa/api research import --campaign <id> \
  --artifact .data/artifacts/9eff756d49a9-romania-261019.osm.pbf
pnpm --filter @elpa/api research match --campaign <id>
pnpm --filter @elpa/api research report --campaign <id> \
  --out .data/next-source/isolated-before-report.json

pnpm --filter @elpa/api research import --campaign <id> \
  --artifact .data/next-source/c71f14ddf061-overture-sample.json
pnpm --filter @elpa/api research import --campaign <id> \
  --artifact .data/next-source/c71f14ddf061-overture-sample.json
pnpm --filter @elpa/api research match --campaign <id>
pnpm --filter @elpa/api research report --campaign <id> \
  --out .data/next-source/isolated-after-report.json
pnpm --filter @elpa/api research incremental-report --campaign <id> \
  --out .data/next-source/evaluation
pnpm --filter @elpa/api research incremental-score \
  --sample .data/next-source/evaluation
```

For a new database the baseline produces 42,861 Candidates and 468,223 Claims;
the register rejects 15 unknown-county rows. Its original output digests and
11,666 suggestions must match the baseline guide. Final Overture parser and
normalizer **@2** produce 17 Candidate records and 116 current proposed Claims
on a fresh campaign, with digest
`c4cf1969214bd4e59d399156198d364700591bbe1fe1cf039b577c8d5e19eb46`.
Repeat import adds zero Evidence/Candidates/Claims. Identifiers and durations
vary; classifications should be 2 likely existing, 2 possible existing,
4 apparent discoveries and 9 screened out. The matcher produces 11,689 total
suggestions, and the source comparison reports zero priority attribute gains.
If earlier experimental @1 runs exist, their immutable history remains; current
observations and record counts are not summed across parser versions.

This sequence's before snapshot assumes a fresh isolated campaign. On an
already populated experiment, use the archived before report or the source-A+B
subsets of the comparison; do not overwrite a historical before measurement and
pretend that the added source was absent.

## Review and inspect

Follow [the rubric](./review-rubric.md). To score two completed independent
discovery sheets:

```sh
pnpm --filter @elpa/api research incremental-score \
  --sample .data/next-source/evaluation \
  --labels .data/next-source/reviewer-a.csv \
  --labels .data/next-source/reviewer-b.csv
```

Without labels, all precision/interval fields are null. Pair and attribute
reviews are inspectable in v1 but not automatically scored. No review file
changes verification status or publication.

With frontend mocks disabled, run `pnpm dev`. Open the isolated campaign and
choose Overture in the existing Candidate source filter; inspect its Runs,
Quality report, Candidate detail, retained Evidence, proposed Claims, and
duplicate suggestions. No public recommendation surface is involved.

## Checks

```sh
pnpm validate
pnpm db:check
pnpm openapi:generate
pnpm --filter @elpa/web exec playwright test --project=chromium
git diff --check
```

The source enum changes are generated into OpenAPI and frontend types by the
normal generator. To verify drift with unstaged task changes, compare checksums
before and after a second generation; do not use an index-relative drift check
as evidence while the intended generated files are unstaged. Synthetic tests
cover licence refusal, content identity, provenance/retention, malformed records,
sampling and partition isolation, uncertain discovery, and independent-label
scoring. Real imports and the private review pack are the additional experiment
evidence; unit tests are not independent ground truth.
