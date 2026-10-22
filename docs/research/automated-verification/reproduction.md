# Reproducing the verification baseline

Prerequisites: the migrated local database with the isolated experiment campaign
(`01a15d8d-edc4-7a6d-bc18-26af6cccfdf3`, see the
[source-value reproduction](../next-source-value/reproduction.md)) and a built API.
Commands run from `apps/api`, so private outputs land in ignored `.data/`.

```sh
pnpm db:migrate                # from the repository root; adds migration 0006
pnpm --filter @elpa/api build
cd apps/api
```

## 1. Seal the corpus

```sh
pnpm research verification-corpus \
  --campaign 01a15d8d-edc4-7a6d-bc18-26af6cccfdf3 \
  --out .data/verification/corpus-v2 \
  --prior ../../docs/research/attribute-extraction/data/manifest.json \
  --prior ../../docs/research/reconciliation/data/manifest.json \
  --prior ../../docs/research/visual-intelligence/data/manifest.json \
  --prior ../../docs/research/next-source-value/data/review-manifest.json
```

Writes `corpus.private.json`, the key-only `manifest.json` and the blind
`review-template.private.json`; existing files are never overwritten. With the
same database state the draw reproduces corpus digest
`04f91d1ea99dec436b52b887867f39cb5319d25da58e78eaab647699f79b3cf1`.

## 2. Capture model assessments (optional, paid)

Set `ANTHROPIC_API_KEY` (and `ANTHROPIC_WORKSPACE_ID` if the key is not scoped to
a workspace) in `apps/api/.env.local`. The budget is cumulative over every capture
in the directory; a call is not started if its worst-case cost would exceed it.

```sh
pnpm research verification-assess --sample .data/verification/corpus-v2 --split development --budget 15 --concurrency 4
pnpm research verification-assess --sample .data/verification/corpus-v2 --split calibration --budget 15 --concurrency 6
pnpm research verification-assess --sample .data/verification/corpus-v2 --split holdout --budget 15 --concurrency 6
```

Captures are appended to `assessments.private.jsonl`; items already captured for
the same request are skipped. Model outputs are not deterministic, so a fresh
capture can differ; the committed figures come from the captured file.

## 3. Decide

```sh
pnpm research verification-run --sample .data/verification/corpus-v2
```

Re-validates every pinned Claim against Research (refusing changed data),
computes strategies A, B and C, and appends strategy C's decisions. A rerun with
the same inputs creates no rows.

## 4. Score and approve

```sh
pnpm research verification-score --sample .data/verification/corpus-v2 \
  --labels reviewer-a.json --labels reviewer-b.json --adjudication adjudication.json
pnpm research verification-approve --evaluation <evaluation id> --category register_classified_capacity
```

Without labels, scoring records `independent_labels_missing` and approval is
refused. Approval succeeds only for a category whose gate passed; afterwards a
new `verification-run` can produce machine-verified decisions for it.

## Inspect

Data Studio → a Candidate page → "Verificare automată (experimentală)" shows the
policy, the evaluation summary and every decision for that Candidate's Claims.
