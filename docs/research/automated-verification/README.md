# Automated evidence verification and confidence calibration baseline

**Decision: no category is enabled for machine verification. Independent labels
do not exist yet, so every predeclared gate is closed.** The controlled
verification system is implemented, run on a sealed 824-item corpus of real
Claims, and ready to score the moment two independent reviewers and an
adjudicator return labels. That is a valid experimental outcome, not a failure
to finish: the system refuses to manufacture confidence.

What is measured today (observed, unlabelled):

- The deterministic policy proposes automatic verification for **718 of 824**
  sampled Claims (strategy C), including 244/245 register localities, 245/245
  OpenStreetMap counties and 227/245 official classified-place counts. None is
  verified: the gate is closed. Correctness of those proposals is **not measured**.
- A capped Claude Sonnet 5.5 assessor ran on all 824 items for **US$4.31**
  (US$0.0052 per item, p50 2.4 s). It invented **zero** Evidence references; 107
  outputs (13 %) were rejected, 104 for quotes that were not verbatim.
- Running the model on everything (strategy B) cut proposals to 451, mostly by
  abstaining on county inferences that no text can confirm; the selective
  strategy C called the model 89 times (US$0.43).
- Bounded follow-up research had **no applicable case**: no duplicate
  suggestion crosses a county boundary (0 of 10,965).

| Deliverable                           | Location                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Automatic Verification Policy      | [Policy](./policy.md), [machine-readable policy](./data/policy.json), `apps/api/src/curation/verification/policy.ts`                                      |
| 2. Deterministic Evidence Validator   | [Policy § validator](./policy.md#deterministic-evidence-validator), `…/verification/validator.ts`                                                         |
| 3. Experimental AI Assessor           | [Policy § assessor](./policy.md#advisory-ai-assessor), `…/verification/assessor.ts`, `apps/api/src/curation/anthropic-assessor.ts`                        |
| 4. Calibration and Evaluation Dataset | [Protocol](./protocol.md), [annotation guide](./annotation-guide.md), [key-only manifest](./data/manifest.json)                                           |
| 5. Verification Benchmark             | [Results](./results.md), [observed report](./data/observed-report.json), [quality report](./data/quality-report.json)                                     |
| 6. Controlled Decision Engine         | [Policy § decisions](./policy.md#decision-engine), `…/verification/decision.ts`, [ADR 0025](../../adr/0025-verification-decisions-record-their-method.md) |
| 7. Selective Research Experiment      | [Policy § follow-up](./policy.md#bounded-follow-up-research), [results](./results.md#selective-follow-up-research)                                        |
| 8. Data Studio Inspection             | Candidate page → "Verificare automată (experimentală)"; `GET/POST /api/admin/verification/*`                                                              |
| 9. Publication Safety Tests           | [Validation](./validation.md)                                                                                                                             |
| 10. Build-versus-Buy Study            | [Build versus buy](./build-vs-buy.md)                                                                                                                     |
| 11. Documentation and Reproduction    | [Reproduction](./reproduction.md), [economics](./economics.md), [validation](./validation.md)                                                             |

## What existed before

Research held 42,878 Candidates and about 468,500 proposed Claims in the isolated
experiment campaign, immutable Evidence, unreviewed Duplicate Suggestions,
text-extraction Claims, three image Evidence records and 28 reconciliation
assessments. **No independent label existed in any earlier experiment**: every
reviewer and decision field in the five prior review sheets was empty. Curation
was an empty module; there were no canonical Providers or Offers. Tests passed
(84 API, 13 web).

## Smallest domain-aligned slice

- **Curation** gains its first tables: append-only `verification_decision`,
  `verification_evaluation` (aggregate reports) and `verification_eligibility`
  (Administrator approvals of passed gates). Decisions reference Claims because
  canonical Offers do not exist yet.
- **Research** exposes one read-only batch reader (`ClaimEvidenceReader`) that
  returns allowlisted, contact-filtered Evidence fields. Research data is never
  written by this work.
- The pure policy domain (`src/curation/verification/`) is lint-guarded against
  NestJS, Drizzle, repositories and model SDKs. The model adapter only returns
  captures; the deterministic policy decides; PostgreSQL constraints refuse
  unapproved machine verification and any publication.
- Long-running work (sampling, model capture, scoring) runs from the research
  CLI, never inside a request.

Original Evidence, Claims and Candidates are unchanged. Nothing was verified or
published. Private corpus files, model captures and review templates stay in
ignored `apps/api/.data/verification/`; only aggregates and key-only manifests
are committed here.
