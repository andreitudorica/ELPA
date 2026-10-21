# Cross-source property intelligence reconciliation baseline

**Decision: investigate further. Independent reconciliation accuracy is not
established.** The implemented deterministic experiment preserves source Claims,
explains comparisons and abstains when context is insufficient. It does not
verify properties or select published values.

The sealed primary corpus contains **28 groups, 74 existing Claims, 49 Candidates
and 49 Evidence records** from the register and OSM, split **17 development / 11
holdout**. It covers eight observed attributes within a fixed 13-attribute
comparison vocabulary. The run produces 53 Candidate/attribute profiles and 49
pair assessments: 15 equivalent, one compatible and 33 unresolved. All 53
profiles retain unknown real-world validity. Thirty pairs share an evidence
origin; no independent corroboration is established. These are observed rule
outputs, not measured semantic correctness.

| Deliverable                                        | Location                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Observed baseline and actual results               | [Results and investment decision](./results.md)                                                                  |
| Comparable propositions, time and state dimensions | [Semantics and independence](./semantics.md), [generated input schema](./data/proposition.schema.json)           |
| Deterministic rules                                | [Research component](../../../apps/api/src/research/reconciliation/engine.ts)                                    |
| Corpus and sampling frame                          | [Key-only manifest](./data/manifest.json), [sampling counts](./data/sampling.json)                               |
| Independent annotation and adjudication            | [Review protocol](./annotation-guide.md)                                                                         |
| Quantitative report                                | [Observed counts](./data/observed-report.json), [uncompleted independent evaluation](./data/quality-report.json) |
| Reproducibility, economics and checks              | [Reproduction](./reproduction.md), [execution measurements](./data/execution.json)                               |
| Persistence boundary                               | [ADR 0024](../../adr/0024-research-reconciliation-assessment-snapshots.md)                                       |

The original 24-case preflight remains in private storage and the database;
its [aggregate snapshot](./data/preflight-v1.json) is retained. Sampling v2
corrected source/attribute imbalance before independent annotation, using only
metadata. No failed record was replaced, no new source was acquired and no
holdout passage was inspected for tuning.

Actual source fields, review templates, results with quotations and original
artifacts remain under ignored `apps/api/.data/`. Their existing retention and
reuse restrictions still apply; register commercial reuse remains unresolved.
No third-party service receives source material. Public files contain only
aggregates, keys, fingerprints and synthetic examples.

Data Studio exposes immutable assessment history on participating Candidate
pages, behind the existing Administrator boundary. It displays all input Claims,
retained passages/locators, times, qualifiers, common-origin warnings, conditional
identity comparisons and rule explanations in Romanian. A result is explicitly
Research-only and independently unreviewed. Catalog, Curation and Recommendation
remain unchanged.

The [validation record](./validation.md) separates automated checks, live local
execution and HTTP checks from the incomplete independent evaluation and manual
visual walkthrough.
