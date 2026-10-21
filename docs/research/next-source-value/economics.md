# Source economics — observed and unmeasured

| Resource                          | Observation                                                                                     | Interpretation                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Remote frame export               | 214.179 seconds for the recorded query                                                          | Wall time of one completed DuckDB export; schema inspection, installation and engineering are extra     |
| Raw frame retained                | 27,911,289 bytes, 21,716 records                                                                | Local serialized bytes, not measured network transfer or billed storage                                 |
| Adapter input                     | 38,224 bytes, 17 records                                                                        | Bounded source sample; source-native fields plus sampling context                                       |
| Initial v1 sample import / repeat | 49 / 36 ms inside the acquisition service                                                       | Development interpretation; immutable history retained                                                  |
| Final v2 sample import / repeat   | 44 / 38 ms inside the acquisition service                                                       | 17 corrected Evidence / 116 Claims, then zero new rows; no new Candidates                               |
| Baseline reconstruction           | Register 46,947 ms; OSM 40,750 ms                                                               | Experimental control setup, not marginal third-source acquisition cost                                  |
| Matching work                     | 465,426 → 466,413 pairs                                                                         | +987 comparisons; CPU time and energy not instrumented                                                  |
| Acquisitions                      | One successful frame query; 17/17 parsed sample records                                         | Parse failure rate 0/17. Individual HTTP requests/retries are unknown                                   |
| Paid services                     | No paid data licence, API, or extraction service purchased                                      | Does not imply compute, network, storage, or engineering are free                                       |
| AI extraction                     | None                                                                                            | Zero extraction-model tokens or image calls; coding-assistant cost not exposed                          |
| Engineering effort                | Adapter, sampling/comparison/review tooling, source-key migration and minimal UI source support | Active engineering hours not instrumented; implementation is not a measured production maintenance rate |
| Maintenance estimate              | Moderate schema/provider/version monitoring; potentially larger matching/review effort          | Qualitative projection only; no recurring refresh history measured                                      |

The recorded frame export cost was about **12.60 seconds per sampled record**,
amortising the whole restricted-frame query over 17 selected records. This is a
description of this experiment, not a per-property production forecast. Setup
work and baseline replication should not be silently charged to or excluded
from a future business ROI calculation; they are shown separately here.

Cost per **reviewed new eligible property** and per **additional independently
supported priority attribute** are **undefined**: there are no independently
reviewed successes, no observed priority enrichment, and no measured all-in
monetary cost. Dividing by unmatched records would invent an economic yield.

Observed marginal yield is four unmatched, screened plausible/ambiguous records
out of 17 sampled records, with novelty and eligibility both unresolved. Only
one is in holdout. Regional counts are in the results report; no county or
national unique-property yield estimate is supported by this design.

Production cost projections require a larger geographic frame, independently
measured discovery precision and review minutes per accepted property,
field-level supported gains, repeat-run breakage, refresh frequency, an agreed
labour rate, and a hosting/storage/network cost model. None is assigned a
fictional currency value in this experiment.
