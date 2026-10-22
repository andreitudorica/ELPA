# Should ELPA train or self-host verification models?

**Recommendation: buy, do not build — for now.** Keep deterministic validation
as the primary verifier, use a hosted model with structured outputs only where
semantic judgement is needed, and invest in independent labels. Revisit a small
domain classifier when the triggers below are met. Training a model in this task
was not justified and was not attempted.

## Options compared

| Option                                                 | Labels needed                              | Expected gain today                                                                | Inference cost                                          | Maintenance and risk                                                                       |
| ------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Hosted model, structured output, Evidence in prompt | None to run; labels to evaluate            | Unknown accuracy; zero invented references observed; strict grounding rejects 13 % | US$0.005 per item; US$0.43 for strategy C on the sample | Pin model and prompt; re-evaluate on version change; data-transfer limits; vendor terms    |
| 2. Small classifier or matcher on ELPA labels          | Hundreds per attribute family, adjudicated | None demonstrable: **0** labels exist                                              | Near zero once trained                                  | Training pipeline, drift monitoring, relabelling; tiny populations for semantic attributes |
| 3. Self-hosted open-weight model                       | Same as 1 to evaluate                      | Possibly privacy (no transfer); quality unknown                                    | GPU hosting dominates at this volume                    | Serving infrastructure contradicts the undecided hosting posture (ADR 0011)                |
| 4. Fine-tuning a general model                         | Large, licensed, adjudicated               | Not justified                                                                      | Training plus serving                                   | Highest cost; risk of learning from unverified conclusions                                 |

## Evidence behind the recommendation

- **Labels:** there are no independent labels in any ELPA experiment. The first
  feasible set is this protocol's ~750 calibration and holdout items, mostly for
  structured facts that deterministic rules already decide. The semantic
  attributes that would benefit from learning are scarce in real data: 14
  text-facility Claims and no event-policy Claims in the 42,878-Candidate
  campaign.
- **Where the value is:** 75,067 of 75,745 frame Claims are structured register
  or geometric facts. The model contributes no verifiable signal for county
  inference and only repeats what the register field already says for capacity.
- **Cost:** the hosted model is cheap at ELPA's volume. Strategy C would spend
  about US$3.5 on the entire semantic part of the frame; a GPU host would cost more
  per month than that.
- **Rights:** the official register's reuse terms are pending legal review and its
  sole-trader data is personal; ODbL share-alike may extend to derived databases;
  Overture's CDLA-Permissive-2.0 permits computational use; Commons images carry
  per-file CC BY-SA licences that this project has not cleared for model training.
  Training on mixed-licence data needs a legal decision first.
- **Ground truth:** model agreement, developer inspection and unverified Claims
  must never become training labels. Only adjudicated independent labels and
  future owner confirmations — subject to their data rights — are training assets.
- **Drift:** OSM changes continuously, the register monthly, model providers on
  their own schedule. Every change of source version, model or prompt requires
  re-evaluation on an untouched holdout, whichever option is chosen.
- **Unseen properties and sources:** no option has been tested on a new source.
  Group-level splits protect this evaluation from near-duplicate leakage, but
  generalization to operator websites remains unmeasured.

## Triggers to revisit

Consider a small classifier (option 2) for one attribute family when all hold:

1. At least 500 adjudicated independent labels for that family across at least
   two source types, with both positive and negative cases.
2. A legal basis for training on those sources.
3. The hosted model fails a moderate-risk gate where errors cluster in patterns a
   classifier can learn (for example negation or shared facilities).
4. Volume makes per-call cost material (projected above about US$100 per month)
   or data transfer is blocked for a needed source.

Consider self-hosting (option 3) only if a needed source cannot legally be sent to
a hosted provider and an ADR settles the hosting platform.
