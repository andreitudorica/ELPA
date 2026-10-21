# Research reconciliation as immutable assessment snapshots

Reconciliation belongs to Research. Store each bounded assessment as an
append-only `reconciliation_assessment` snapshot in PostgreSQL, with input Claim
identifiers and comparison projections, rule version, explicit reference time,
input fingerprint, rationale, result and acting Administrator. A unique key on
campaign, fingerprint and rule version makes identical reprocessing idempotent.
A new input, reference time or rule version adds history. Record executions in
Audit, including repeats. Expose history only through Administrator-protected
Data Studio.

## Why

Claims assert what a source says. A reconciliation assessment reasons about
several Claims and their limitations; storing it as a new source Claim would
confuse those authorities. Acquisition Runs likewise describe acquisition or
extraction from source artifacts, not a comparison across them. Recomputing only
on reads would lose the exact inputs and rules that explained an earlier result.
The experiment therefore needs one small derived snapshot table, not a knowledge
graph or a verification workflow.

## Consequences

Original Evidence and Claims remain untouched. Support, corroboration, temporal
applicability and freshness are separate dimensions. A supported source assertion
is still proposed and unverified; it is not a canonical value. Different
Candidates remain separate, and comparisons across them are explicitly
conditional because existing Duplicate Suggestions have not been adjudicated.

The bounded payload is validated with Zod before persistence. Source references
are checked against retained Claims and Evidence. PostgreSQL remains the system
of record; private corpus exports are reproducibility artifacts. JSONB validity
endpoints are sufficient for this experiment because all real sampled validity
periods are unknown and no range-search workload exists. Introduce relational
membership or range indexes only when a measured query requires them.

There is no assessment update/delete operation, automatic verification,
publication, model call or Recommendation projection. The versioned experiment,
its independent-review limitations and promotion decision live in
[`docs/research/reconciliation/`](../research/reconciliation/README.md).
