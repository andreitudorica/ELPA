# Validation record — 22 October 2026

- Before implementation, root validation passed with 57 API tests, 12 web tests
  and two boundary probes, including lint/typecheck/build for both applications.
- Root validation passed after the slice was added. Following the final source-
  association and normalization checks, API validation passed with **84 tests
  across 18 files**. Web validation passed with **13 tests across seven files**.
  The new component test checks source links, identity uncertainty, rule
  explanations and the absence of verification/publication controls.
- Both Chromium end-to-end/accessibility smoke tests passed. These existing
  smoke tests do not exercise the live reconciliation page.
- Migration `0005` was generated, reviewed and applied locally. `pnpm db:check`
  passed. OpenAPI and web types were regenerated through their generators.
- The initial and amended corpora were each executed twice against the local
  database. Repeats added zero assessment rows; both corpus versions reproduced
  the same output digests again with the final code in an offline replay.
- Read-only SQL confirmed 42,878 Candidates, 468,502 Claims, no non-unverified
  Candidates, 52 distinct assessment fingerprints (24 preflight + 28 primary),
  two corpus-export Audit events and four completed-execution Audit events.
- Live HTTP checks validated the strict response schema for a development
  Candidate: protected read 200, public equivalent 404, wrong-campaign read 404,
  POST mutation 404. Source assertions remain proposed. Readiness returned OK.
- Private corpus, review template and quoted result files have mode `0600`.
  Corpus checksum/tamper, duplicate, partition/lineage, invalid reference,
  source-association, status and storage-boundary regressions use synthetic inputs.
- Formatting and whitespace checks passed. No dependency or source adapter was
  added, and no prior migration was edited.

A manual browser inspection was attempted but interrupted by ongoing activity in
Chrome; an isolated browser surface was unavailable. The final page has component
coverage and a verified live backend, but a completed manual visual walkthrough
is **not claimed**. Development servers were restarted for local inspection.

Independent human annotations, adjudication, semantic accuracy, actual owner
confirmations and observed temporal/policy-change ground truth remain absent.
The quality report keeps these metrics null. Automated checks are not evidence
that independently evaluated reconciliation or commercial value has been proven.
