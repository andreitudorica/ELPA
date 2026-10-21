# Validation record

Local validation performed on 2026-10-21/22 using the pinned toolchain.

- Before implementation: API 41 tests and web 11 tests passed.
- Final API: lint and typecheck passed; **54 tests across 11 files passed**.
  Production build and OpenAPI generation passed. The subsequent scoring,
  capture-retention and attribution checks passed lint/typecheck/tests and the
  running Nest watcher compiled successfully.
- Web: `validate` passed lint/typecheck, **12 tests across six files**, and the
  production build. Existing unrelated `AxeBuilder` import-style lint warning
  in `e2e/smoke.spec.ts` remains; no rule was weakened.
- Migration 0004 generated from the schema, reviewed and applied locally;
  `pnpm db:check` passed. Candidate source/status and Claim status checks remain.
- OpenAPI and web types were generated together; generated files were not edited.
- Real acquisition: three attempts, three successful licensed image originals,
  three immutable image Evidence/artifact identities, no rejected images.
- Two subsequent offline replay passes reused all three identities, made no
  external calls and created no Candidate/Claim. Database history now contains
  nine successful image runs and nine acting-Administrator import audit events.
- Read-only aggregate audit confirms original/isolated Candidate and Claim
  totals unchanged and zero verified Candidates, accepted Claims or image Claims.
  See [database aggregates](./data/database-audit.json).
- Real HTTP preview: 200 PNG, exact retained preview SHA-256, `private, no-store`
  and `nosniff`. Wrong-Candidate and public-route requests return 404.
  See [HTTP aggregates](./data/http-validation.json). Guard metadata is covered
  by a unit test; no anonymous-access bypass was introduced.
- Native Chrome inspection of the development Candidate displayed the real
  retained preview, source credit/licence, capture/retrieval context, unreviewed
  attribution warning, no-model/pending-annotation status and related text Claims.
  The holdout images were not opened for semantic tuning. UI inspection is an
  engineering check, not an independent visual ground-truth annotation.
- Original and preview files use mode 0600 in private directories. Public exports
  contain aggregate measurements, synthetic observability examples and key/hash
  manifests; no source photographs, captions, author metadata or review sheets.

The Romanian passages in `observability.json` are synthetic illustrations of
interpretation rules, not acquired corpus passages or evaluation labels.

No real independent labels, adjudication outcomes, model outputs, semantic
accuracy, national coverage or cost per validated visual attribute were invented.
The formal semantic/model evaluation remains incomplete.
