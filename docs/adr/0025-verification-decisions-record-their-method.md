# Verification Decisions record their method; machine verification needs an evaluated eligibility

Curation owns **Verification Decisions** as append-only rows about one Claim
each. Every decision records its **Verification Method** — machine policy or
Administrator now, owner confirmation once an owner-statement Evidence source
exists — together with the policy version, the validation, assessment and
follow-up inputs it used, and the acting Administrator. A machine decision can
reach the outcome `verified` only when an Administrator has approved a
**Verification Eligibility** for that category from an evaluation whose
predeclared gates passed on independently adjudicated labels. The
high-consequence category can never become autonomous. Publication remains a
separate, not yet implemented decision; publication eligibility is derived from
the decision method and the category, not stored.

## Why

- The product is automation-first: human review should be an exception,
  evaluation mechanism or escalation path. A single Verification concept with a
  method dimension lets low-risk categories be verified by an evaluated machine
  policy without ever presenting a machine decision as a human one.
- Separate "machine-verified" and "human-verified" states would duplicate
  reverification, freshness and override logic and invite inconsistent
  displays. Method is metadata on one decision; risk is a property of the
  category.
- Storing assessments as Claims would confuse source authority with ELPA's
  reasoning (as ADR 0024 found for reconciliation). Research proposes; Curation
  decides (ADR 0013), so decisions live in Curation and reference Claims.
- A model's self-reported confidence is not evidence of correctness. Only
  independent labels, a threshold selected on a calibration split and an untouched
  holdout can justify autonomy, so autonomy is a recorded approval tied to an
  evaluation rather than a configuration flag.

## Consequences

- PostgreSQL enforces the boundary: a `machine_policy` decision with outcome
  `verified` requires an eligibility row; the high-consequence category cannot be
  machine-verified; Administrator decisions need a reason of at least ten
  characters; only Administrators reject; the publication column is pinned to
  "separate decision required"; an eligibility needs at least two reviewers, at
  least 100 accepted holdout items and an error bound of at most 5 %.
- That an eligibility's category matches its decision's category is checked by the
  Curation write boundary, not by a cross-table database constraint.
- Decisions reference Claims and Candidates because canonical Providers and
  Offers do not exist yet. Canonical value selection and Publication remain
  future Curation decisions.
- AI assessors are provider-neutral adapters that return captures. Deterministic
  code validates every capture (schema, cited references, verbatim quotes) and
  the policy decides; adapters never write.
- The glossary definition of Verification changes from "a human decision" to a
  decision recorded with its method. The versioned policy, its evaluation
  protocol and the first results are in
  [`docs/research/automated-verification/`](../research/automated-verification/README.md).
