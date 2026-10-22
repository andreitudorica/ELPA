# Verification economics — observed and unmeasured

| Resource                     | Observed                                                    | Interpretation                                                        |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Deterministic policy         | 38 ms for 824 items, three strategies, local                | Negligible compute; database reads and writes not separately timed    |
| Corpus export                | About 2 s for a 75,745-Claim frame and 824 sealed subjects  | Local PostgreSQL; one run                                             |
| Model assessment (all items) | 824 calls, US$4.3126, 1.33 M input / 0.17 M output tokens   | First-party rates for `claude-sonnet-5-5` (US$2 / US$10 per M tokens) |
| Per call                     | US$0.00523 mean; p50 2.4 s, p90 3.2 s                       | Effort low; prompt caching was not configured                         |
| Wall time                    | 45 s (70 calls, 4 parallel), 145 s (339, 6), 176 s (413, 6) | No failed calls; SDK-internal retries were not instrumented           |
| Strategy C model use         | 89 calls, US$0.4323                                         | The model is called only for categories that need semantic judgement  |
| Failed set-up calls          | 4, US$0                                                     | Missing credentials and a missing workspace header, before inference  |
| Follow-up research           | 0 actions, 0 network calls, US$0                            | No applicable item                                                    |
| Human review                 | Not performed                                               | About 1,250 judgements required; time per judgement unmeasured        |

## Cost per correct fact

**Undefined.** There are no independently confirmed correct approvals. Dividing
model spend by unlabelled proposals would invent a yield. The scorer reports
`costPerCorrectApprovalUsd` per strategy once labels exist; human review minutes
(`seconds` in the review files) will be the dominant term.

## Projections (arithmetic, not forecasts)

- Strategy C on the whole policy frame calls the model only for text facilities,
  counts and high-consequence attributes (678 Claims): about US$3.5 at the
  observed mean.
- Strategy B on all 75,745 frame Claims would cost about US$396 and, on the
  observed sample, would mainly add abstentions on county inferences.
- Deterministic verification of the lower-risk categories (75,067 Claims) needs no
  model calls; once a gate passes, its marginal cost is local compute.

Projections assume the observed token profile and current prices, and include
neither engineering time nor review time. Re-measure after any prompt, model or
price change.
