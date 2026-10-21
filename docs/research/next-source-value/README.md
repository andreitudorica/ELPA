# Incremental value of the next source

**Decision: investigate further. Incremental business value is not proven.**
One bounded, permitted Overture Places sample was integrated through Research
and compared with a reproduced national baseline. Its four apparent discoveries
remain unverified, it added no priority rental/event attributes, and the sparse
county-metadata frame prevents national inference. Independent human review is
pending. Import success is not a production promotion decision.

| Deliverable                                      | Evidence                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Observed baseline and partial capabilities       | [Baseline assessment](./baseline-assessment.md), [aggregate snapshot](./data/baseline-observed.json)                                 |
| Source family comparison and permissions         | [Source selection memo](./source-selection.md)                                                                                       |
| Frozen hypotheses and sampling                   | [Protocol](./protocol.md), [key-only sample manifest](./data/sample-manifest.json)                                                   |
| Acquisition context and lawful source references | [Frame metadata](./data/frame-acquisition.json), [fixed SQL](./export-frame.sql); raw inputs remain private                          |
| Working bounded adapter                          | `apps/api/src/research/acquisition/overture-places-source.ts`; parser/normalizer @2                                                  |
| Discovery, attribute and before/after results    | [Results and decision](./results.md), [aggregate comparison](./data/incremental-report.json)                                         |
| Independent evaluation                           | [Rubric](./review-rubric.md), [holdout manifest](./data/review-manifest.json), [pending score](./data/independent-review-score.json) |
| Economics                                        | [Observed costs and unknowns](./economics.md)                                                                                        |
| Data Studio inspection                           | Existing source filter, Runs, report, Candidate Evidence/Claims and suggestions in the isolated experiment campaign                  |
| Reproduction and tests                           | [Commands, inputs and expected results](./reproduction.md)                                                                           |

Checks and known limitations are recorded in [validation](./validation.md).

The observed local campaign is
`01a15d8d-edc4-7a6d-bc18-26af6cccfdf3`. Its database id is incidental;
reproduction creates/finds the campaign by name. The original baseline and the
earlier Cluj birthday campaign are not altered by the experiment.

Only aggregates, source keys, checksums and synthetic fixtures belong in this
public repository. Real records, original Evidence exports, individual labels
and review sheets stay under ignored `apps/api/.data/`. Do not replace missing
review with developer-generated labels or treat unmatched records as new Offers.
