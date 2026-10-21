# Validation record

Live Data Studio inspection loaded all 17 source-filtered Candidates and showed
current @2 Claims, immutable Evidence/history, and a duplicate suggestion in
Candidate detail. The pre-existing list suggestion counter incorrectly shows
zero; this is documented in the baseline assessment and was not used for
measured overlap or fixed as part of the source experiment.

Observed on 2026-10-21 for the finalized parser/normalizer @2:

| Check                                          | Result                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Direct baseline API / web tests before changes | 4 / 10 passed; API acquisition tests were absent                                                      |
| `pnpm validate`                                | Passed formatting, both app lint/typecheck/test/build checks; 17 API tests and 10 web tests           |
| Chromium Playwright smoke                      | 2 passed, including public-page accessibility and unauthorized Studio redirect                        |
| `pnpm db:check`                                | Passed                                                                                                |
| Generated migration                            | Reviewed before applying; changes only source-key and reuse-terms CHECK vocabularies                  |
| `pnpm openapi:generate` repeated               | Generated OpenAPI and frontend type SHA-256 values unchanged                                          |
| Reproduced baseline                            | Original record/Claim counts, digests, compared pairs and suggestions reproduced in isolated campaign |
| Final adapter repeated import                  | Same output digest, zero new Evidence/Candidates/Claims on repeat                                     |
| Independent scoring with no labels             | No precision/recall/interval invented; gate remains unpassed                                          |
| Private artifact handling                      | `.data` excluded from Git and formatter; source bytes remain pinned                                   |

The existing frontend lint warning in `apps/web/e2e/smoke.spec.ts` about the
`AxeBuilder` default-import name remains; it is unrelated to this task and does
not fail validation. Initial sandbox attempts to bind the Playwright server
were denied; the successful run used the approved local server permissions.

The unit tests are deterministic synthetic cases. Real imports and inspection
are additional evidence, not independent human truth. No API database integration
test tier, full browser matrix, production deployment, recurring acquisition,
pair/attribute review, or human adjudication was performed.
