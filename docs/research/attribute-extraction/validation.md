# Validation record

Completed locally on 2026-10-21 for `grp-text-rules@2`.

| Check                          | Observed result                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm validate`                | Passed formatting, API/web lint, type checks, tests and builds. API 41 tests; web 11 tests. Existing unrelated AxeBuilder import warning remains.                                                          |
| `pnpm db:check`                | Passed after generated migration `0003` was applied.                                                                                                                                                       |
| OpenAPI/client regeneration    | Passed; a second generation reproduced SHA-256 `5c9c2a0c03e6…` for OpenAPI and `1cc7390c769e…` for client types. The v2 rule-only correction changes no API schema.                                        |
| Chromium smoke/a11y            | Both existing tests passed (public landing and unauthorized Studio redirect). These tests use the existing mock/network setup, not a live API integration project.                                         |
| Real corpus execution          | 48 documents; v2 created 22 proposed Claims; its repeat created zero with identical digests. v1's 25 Claims remain historical.                                                                             |
| Persistence/Audit inspection   | 47 stored extraction Claims across two method versions; 12 started and 12 completed extraction Audit events across four passes/three artifact groups. No non-proposed Claims or non-unverified Candidates. |
| Original national baseline     | Still 468,223 Claims; extraction ran only in the isolated experiment campaign.                                                                                                                             |
| Live Administrator Data Studio | Development Candidate loaded against the real API. Current v2 and historical v1 methods, historical label, source passage/span link and independent-review warning were visible.                           |
| Codebase Memory                | Refreshed and persisted as project `ELPA`; private artifacts remain excluded.                                                                                                                              |

The unit suite includes a synthetic duration/price regression that failed the
old capacity rule and passes v2. These fixtures test behavior, not real-world
accuracy. Persistence tests use explicit collaborators; manual database runs
supplement them. There is no new CI PostgreSQL integration harness.

Independent human annotation, semantic quality metrics, live AI extraction and
hybrid evaluation were **not completed**. Their absence is recorded in the
reports rather than replaced with developer or fabricated ground truth. The
local development servers were restarted for inspection.
