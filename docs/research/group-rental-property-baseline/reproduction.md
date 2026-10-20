# Reproduction instructions

## Requirements

- Node.js ≥ 24.19.0 and pnpm 10 (repository-pinned), Docker for PostgreSQL 17.
- About 2 GB of free memory and 1 GB of disk for the OSM import.
- `apps/api/.env.local` from `.env.example` (local visibility, simulated
  Administrator `admin@elpa.local`).

All `research` commands run from the API workspace (`pnpm --filter @elpa/api
research …` executes `node dist/research-cli.js` in `apps/api`), so relative
paths are relative to `apps/api`. Artifacts and exports go to the ignored
`apps/api/.data/` directory and are never committed.

## Pinned inputs

| Source                         | Artifact                                                                                                    | SHA-256                                                                                                                                                                 | Dataset version      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Register (SITUR `listaCazari`) | `Lista-structurilor-de-primire-turistice-cu-funcțiuni-de-cazare-clasificate-actualizată-la-21.10.2026.xlsx` | `d4854cff79bc1d92508d7845591e2041351f0d98c247b13437b9cf8824a9433b` (and the byte-different download `1765427e22acc9001ce41708f41a618a09ff14f3b682411cec08bea23843067b`) | 2026-10-21           |
| OpenStreetMap (Geofabrik)      | `romania-261019.osm.pbf` (MD5 `5176524c92870e6ff21cf2a8ad5978df`)                                           | `9eff756d49a9a77ff354a98c2b0b5674eaed9cbd88e24399464248b69cfb948a`                                                                                                      | 2026-10-19T20:21:11Z |

The register serves only its latest version and regenerates the file on every
download, so an exact rerun needs the archived artifact. Because its reuse
terms are unconfirmed, the team must keep that archive in private storage; it
cannot be placed in this public repository. Geofabrik keeps dated extracts for
a limited time.

## Steps

```sh
pnpm install
cp apps/api/.env.example apps/api/.env.local
pnpm db:up && pnpm db:migrate
pnpm --filter @elpa/api build

# 1. Obtain artifacts (writes <file> and <file>.manifest.json with URL, time, checksum)
pnpm --filter @elpa/api research fetch --source situr_accommodation_register --out .data/artifacts
pnpm --filter @elpa/api research fetch --source osm_geofabrik_romania --out .data/artifacts \
  --url https://download.geofabrik.de/europe/romania-261019.osm.pbf
# An archived artifact needs a manifest next to it with the same fields.

# 2. National baseline campaign (idempotent by name); note its id
pnpm --filter @elpa/api research baseline-campaign

# 3. Imports, then a repeat to prove idempotency
pnpm --filter @elpa/api research import --campaign <id> --artifact .data/artifacts/<register file>
pnpm --filter @elpa/api research import --campaign <id> --artifact .data/artifacts/<osm file>
pnpm --filter @elpa/api research import --campaign <id> --artifact .data/artifacts/<register file>

# 4. Duplicate suggestions (repeat to prove idempotency), report, and review sample
pnpm --filter @elpa/api research match --campaign <id>
pnpm --filter @elpa/api research report --campaign <id> --out .data/reports/baseline-report.json
pnpm --filter @elpa/api research evaluation-sample --campaign <id> --out .data/evaluation/grp-eval-sample-1
```

Each import prints its run id, status, statistics, and output digest, and is
visible in Data Studio. A failed import exits with code 1 and is recorded with
status `failed` and a classified error.

## Expected deterministic outputs

| Step                                 | Expected                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register import (first)              | `completed_with_rejections`; 32,231 read, 15 rejected (`unknown_county`); 32,231 Evidence; 32,216 Candidates; 397,491 Claims; digest `db591e6e3f8fed79b9e6f5893e7383c9a8ecd3c51a5a27a9e2d704b579101199` |
| OSM import                           | `succeeded`; 10,645 records; excluded 354; 70,732 Claims; digest `2e43104341c72fa5e79d2a5abd7f0492d06f07ecba41536a8471285e7f09207b`                                                                     |
| Register re-import (either artifact) | same digest; 0 new Evidence, Candidates, and Claims                                                                                                                                                     |
| Match (first / repeat)               | 465,426 pairs compared; 11,666 suggestions (3,181 likely and 7,764 possible same-property; 10 likely and 711 possible same-provider) / 0 created on repeat                                              |
| Report                               | matches [`data/acquisition-report.json`](./data/acquisition-report.json) except ids and timestamps                                                                                                      |
| Evaluation sample                    | 352 items (136 record, 151 pair, 65 eligibility); item ids and strata match [`data/evaluation-sample-1.manifest.json`](./data/evaluation-sample-1.manifest.json)                                        |

Database ids (UUIDv7) and timestamps differ between runs. Digests, counts,
record keys, and sample item ids do not, provided the parser, normalizer,
rubric, matcher, and sample versions are unchanged.

## Inspecting the experiment

Run the API (`pnpm --filter @elpa/api dev`) and the web app with mocks
disabled (`VITE_ENABLE_MOCKS=false pnpm --filter @elpa/web dev`), open
`http://localhost:5273/studio/research-campaigns`, and choose
"Experiment de achiziție" on the campaign card.

## Validation

`pnpm --filter @elpa/api lint`, `typecheck`, `build`, `pnpm db:check`, and
`pnpm openapi:check` cover this change; `pnpm --filter @elpa/web lint` and
`typecheck` cover the Data Studio pages. Automated tests for the acquisition
slice were deliberately deferred in this change (see the
[README](./README.md#status-of-the-acceptance-criteria)); the commands above
are the current reproducibility evidence.
