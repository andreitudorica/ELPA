# Extraction economics

Observed execution is recorded in [execution.json](./data/execution.json).
The first current-version (`grp-text-rules@2`) pass processed 48 documents and
proposed 22 Claims in **7.31 ms** of measured extraction computation, excluding database reads/writes,
CLI boot, sampling, annotation and development. The repeat measured **7.25 ms**.
These two local timings are observations, not a production latency distribution
or throughput guarantee. Three artifact-level runs per pass completed without
record rejection; the repeat created zero Claims. There were no new downloads.
The superseded v1 runs measured 6.94 ms and 7.58 ms and proposed 25 Claims;
these are retained in the v1 snapshot. Both methods together store 47
historical/versioned Claims, not 47 distinct facts.

| Item                                          | Observed               | Limits / projected work                                              |
| --------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| External extraction/model calls               | 0                      | AI capture harness only; no provider dependency                      |
| Download/API/model fees incurred by this task | EUR 0 externally       | Local compute and prior acquisition costs are excluded               |
| Model tokens or image processing              | None                   | No AI/image execution                                                |
| Local corpus JSON                             | 67,165 bytes           | Private primary fields, not full source artifacts                    |
| Deterministic output JSON                     | 135,547 bytes          | Includes explicit abstentions, not 136 KB of new facts               |
| Stored Claims                                 | +22 current, repeat +0 | 14 restate already-proposed same-Evidence values                     |
| New Candidate/attribute cells                 | 7 proposed             | Independent correctness unknown                                      |
| Independent annotation time                   | Not observed           | No annotation supplied; cannot price review per fact                 |
| Engineering/maintenance money                 | Not observed           | No time-tracking or hourly-rate basis; no invented monetary estimate |
| Incremental local DB/storage cost             | Not metered            | Existing PostgreSQL; no added infrastructure                         |

The snapshot lists actual byte sizes of the private experiment files. Original
artifacts were already retained by the earlier experiments and are not an
incremental extraction acquisition cost. Sampling and persistence wall time
were not separately instrumented in the first run; do not substitute the 7.31 ms
rule execution time for end-to-end processing latency.

Cost per independently correct supported fact, cost per additional correct fact,
and marginal AI value are **undefined** without independent labels/model results.
Dividing zero external fees by 22 proposed Claims would misleadingly imply that
obtaining reliable knowledge is free. Cost per additional independent source
support is also undefined: no second evidence source was acquired here.

Projected maintenance includes vocabulary changes, source-projection drift,
semantic error review, ontology/prompt versioning, holdout renewal and rights
review. This is qualitatively bounded code maintenance in the existing API,
but human evaluation is likely the gating cost; that is a hypothesis to measure,
not an observed cost estimate. No production cost or budget forecast is supplied.
