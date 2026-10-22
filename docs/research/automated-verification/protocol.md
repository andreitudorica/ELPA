# Verification evaluation protocol `elpa-verification-corpus@2`

Frozen on 2026-10-22 before any independent label exists. Thresholds, gates and
splits below may not be changed after holdout labels are read; a change needs a
new corpus or policy version and leaves this result in place.

## Frame and sampling

- **Frame:** every Claim in the isolated experiment campaign
  (`01a15d8d-edc4-7a6d-bc18-26af6cccfdf3`) whose target the policy can
  categorize — 75,745 Claims: register locality 32,216; OSM county 10,645;
  register classified places 32,206; text facilities 14; property-shape counts
  623; high-consequence attributes 41.
- **Leakage groups:** union-find over all same-property Duplicate Suggestions and
  identical Evidence content. A group always lands in one split, chosen by the
  seeded hash of the group (`elpa-verification-2026-10-22`): about 12 %
  development, 38 % calibration, 50 % holdout. At most one item per group and
  category is drawn.
- **Earlier experiments:** records in the holdout of the extraction,
  reconciliation, visual or Overture experiments go only to this holdout; their
  development records never enter this holdout. Seven drawn items were earlier
  holdout records.
- **Strata and quotas:** per category and split, stratified by condition
  (conditional conflict / agreement / single record for locality; reprocessed
  copy / has counterpart / single record for classified places; current /
  superseded for text facilities; structured tag / text span for counts; text /
  structured capacity for high-consequence). Quota per split: 20 / 100 / 125 for
  the three lower-risk categories; all available text-facility items; 6 / 20 / 20
  counts; 6 / 15 / 20 high-consequence. Quota is apportioned to strata by
  highest averages; a stratum with too few groups passes its quota to the others.
  Each item carries its stratum weight (population ÷ sampled) for weighted estimates.
- **Result:** 824 items — 72 development, 339 calibration, 413 holdout. The
  key-only [manifest](./data/manifest.json) pins item, Claim, Candidate, source
  record, stratum, split, weight and group, with the corpus digest
  `04f91d1ea99dec436b52b887867f39cb5319d25da58e78eaab647699f79b3cf1`.

**Amendment.** A first draw (`elpa-verification-corpus@1`, digest
`2460385cdb04cd8c0a96c23821916723f9c2f1e9ae0603489fc5422d7582981a`, 696 items)
left the empty conditional-conflict strata's quota unfilled, so each locality
holdout had 101 items and could never meet the 100-acceptance gate. It was
superseded before any assessment, label or holdout inspection; its private files
remain. Version 2 changes only the apportionment; the seed and therefore every
group's split are unchanged.

## Use of each split

- **Development:** may be inspected by engineers; prompt and rule changes are
  made only from it. Two changes were made before freezing: the validator now
  accepts an empty optional register field ("Localitate componentă"), and no
  prompt change was needed.
- **Calibration:** independent labels select each category's evidence-score
  threshold; content may be labelled but is not used to change rules or prompts.
- **Holdout:** labelled blind; read only by the scorer after thresholds are
  selected from calibration in the same deterministic run.

## Labels

Two independent human reviewers label every holdout item; calibration items need
one reviewer, with at least 25 % double-reviewed to measure agreement. An
adjudicator who is neither reviewer resolves every disagreement. Labels:
`supported`, `contradicted`, `insufficient_evidence`,
`incorrect_entity_attribution`, `outdated`, `ambiguous`. Only `supported` counts
as a correct approval. Developer, system or model output is never a label; see
the [annotation guide](./annotation-guide.md).

## Predeclared gates

A category may be approved for machine verification only if, for strategy C:

| Requirement                                     | Lower risk | Moderate risk | Higher risk |
| ----------------------------------------------- | ---------- | ------------- | ----------- |
| Independent reviewers                           | ≥ 2        | ≥ 2           | never       |
| Holdout fully double-reviewed and adjudicated   | yes        | yes           | never       |
| Raw reviewer agreement on double-reviewed items | ≥ 90 %     | ≥ 90 %        | never       |
| Calibration threshold meets the targets below   | yes        | yes           | never       |
| Holdout auto-approvals                          | ≥ 100      | ≥ 150         | never       |
| Holdout false-approval rate                     | ≤ 2 %      | ≤ 1 %         | never       |
| One-sided 95 % Clopper–Pearson upper bound      | ≤ 5 %      | ≤ 2 %         | never       |

For lower risk, 100 approvals with zero or one false approval pass (upper bounds
2.95 % and 4.66 %); two fail (6.16 %). For moderate risk, 150 approvals pass only
with zero false approvals (1.98 %; one gives 3.12 %). The moderate-risk gate
cannot be met by this corpus (14 text-facility Claims exist in the whole frame),
which is reported rather than relaxed.

## Calibration and reporting

- **Selective prediction:** on calibration labels, the lowest evidence-score
  threshold whose accepted items meet the point and upper-bound targets is
  selected; risk–coverage points are reported for every threshold.
- **Conformal risk control:** the smallest threshold whose marginal
  false-approval risk bound `(Σ loss + 1)/(n + 1)` is within the point target is
  reported alongside.
- **Reliability:** histogram binning maps each calibration score bin with at
  least ten items to its precision; holdout accuracy per bin and the expected
  calibration error are reported. No calibrated confidence is claimed for
  smaller samples.
- **Holdout metrics:** auto-approvals, correct and false approvals, false
  rejections, abstentions, contradictions flagged, coverage and precision with
  exact 95 % intervals, false-negative rate, assessment cost and cost per correct
  approval; by category, source and condition (including conflicting evidence).
- Strategies A, B and C are scored on the same labels.
