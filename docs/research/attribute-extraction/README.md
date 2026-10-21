# Evidence-grounded property attribute extraction baseline

**Decision: investigate further. Independent semantic evaluation is incomplete.**
The implemented experiment runs end to end over retained primary Evidence;
successful technical grounding does not establish accurate property knowledge.
No AI model was called and nothing was verified or published.

The sealed corpus contains **48 actual source records**: 32 OSM, 12 register
and four Overture records, with **24 development / 24 holdout documents** across
22 counties. Sixteen contain descriptions; 12 have no allowlisted attribute
content. The remaining records provide structured fields. This is a deliberately
stratified experimental sample, not a national Group Rental Property sample.

The current deterministic method (`grp-text-rules@2`) proposed **22 Claims**.
Fourteen repeat values already proposed from the same Evidence. Eight
observations populate seven previously empty Candidate attributes. All 22 pass
technical reference/span validation;
none has independent semantic confirmation. A repeat creates zero Claims and
reproduces all three artifact-level output digests.

Version 1 proposed 25 Claims. A synthetic regression case exposed a rule that
could mistake durations/prices for guests; v2 requires a person unit or an
explicit standalone English `sleeps` phrase. Its output count fell by three,
without inspecting holdout passages or labels. All 25 old Claims remain as
history; they are not counted as additional current knowledge. The v1 aggregate
snapshot is retained under `data/v1/`.

| Deliverable                                      | Location                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Actual system/data assessment                    | [Baseline assessment](./baseline-assessment.md)                                                                                          |
| Frozen sampling and hypotheses                   | [Protocol](./protocol.md), [key-only manifest](./data/manifest.json)                                                                     |
| Versioned 25-attribute ontology                  | [Machine-readable definition](./data/ontology.json), [source](../../../apps/api/src/research/extraction/ontology.ts)                     |
| Blind annotation and adjudication                | [Annotation guide](./annotation-guide.md)                                                                                                |
| Deterministic extraction and technical grounding | [Rules](../../../apps/api/src/research/extraction/deterministic.ts), [contracts](../../../apps/api/src/research/extraction/contracts.ts) |
| Structured AI comparison boundary                | [Captured-output harness](../../../apps/api/src/research/extraction/ai.ts), [method comparison](./data/method-comparison.json)           |
| Counts, quality limitations and decision         | [Results](./results.md), [per-attribute score](./data/deterministic-score.json)                                                          |
| Costs and observed execution                     | [Economics](./economics.md), [execution snapshot](./data/execution.json)                                                                 |
| Commands, inputs and tests                       | [Reproduction](./reproduction.md)                                                                                                        |

Actual primary texts, exact span labels, prediction review material and source
artifacts remain private under `apps/api/.data/`. Only aggregates, source keys,
checksums and synthetic fixtures are public. The blind annotation template has
not been completed; zero reviewers and zero scored holdout cells are explicit.
The provider-neutral AI harness accepts strictly validated, authorized captured
outputs and compares them on this same corpus; no provider or budget was
authorized, so the live AI extractor and hybrid were not executed.

Research owns the implementation. Existing Evidence, Acquisition Runs,
unverified Candidates, proposed Claims, unit of work, Audit and admin Data Studio
are reused. No new service, runtime, queue, authoritative store, public UI or
source adapter was introduced. Migration `0003` adds an extraction stage and
observation-level Claim uniqueness to preserve contradictions and history.

The [validation record](./validation.md) separates automated checks, real local
execution, live Data Studio inspection and the evaluations that remain incomplete.
