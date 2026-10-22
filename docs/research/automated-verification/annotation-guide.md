# Independent verification review guide

For reviewers labelling `elpa-verification-corpus@2`. Work from the private
template `apps/api/.data/verification/corpus-v2/review-template.private.json`;
never commit a filled sheet.

## Independence

- Do not look at ELPA's validation results, recommendations, evidence scores,
  model assessments or another reviewer's labels before submitting yours. The
  template contains none of them.
- Do not use a language model to propose labels.
- Write an independence statement in your file, for example: "Labelled blind,
  without system or model outputs and without consulting the other reviewer."
- The adjudicator must be a third person. They see both labels only for
  disagreements and record one final label with a rationale.

## What to judge

For each item, decide whether the **proposition** is true for the **named
property** as of the dataset version shown, using the retained Evidence and any
lawful public source you consult (for example the official register portal, a
map, the operator's own page). Record every source in `evidenceInspected`.

| Category                       | Question                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register_locality`            | Is the classified unit in this county and settlement (or locality) as the register states? A wrong parse, wrong component village or wrong property counts as an error. |
| `osm_county`                   | Is this OSM object's location inside the stated county? Ignore the settlement.                                                                                          |
| `register_classified_capacity` | Does the official register list exactly this number of classified places for this certificate? This is not maximum guests.                                              |
| `explicit_text_facility`       | Does the property itself offer this facility to guests, as explicitly stated? Shared, public, nearby, seasonal-only or negated facilities are not support.              |
| `property_shape_count`         | Is this count of beds/rooms/bedrooms/bathrooms correct for the property now?                                                                                            |
| `high_consequence`             | Is this capacity, permission, exclusivity, availability or rule explicitly and currently true? Silence is never support.                                                |

## Labels

- `supported` — true for this property, scope and time.
- `contradicted` — an authoritative or explicit source shows a different value.
- `insufficient_evidence` — you cannot establish it from available lawful sources.
- `incorrect_entity_attribution` — the Evidence concerns another property, unit or
  a shared/public facility.
- `outdated` — it was true but is no longer current (closure, re-classification).
- `ambiguous` — the wording or definition does not allow a yes/no judgement
  (approximate, seasonal, unclear capacity basis).

Only `supported` counts as a correct approval when scoring.

## File format

One JSON file per reviewer, validated against `reviewSchema` in
[`policy.json`](./data/policy.json):

```json
{
  "corpusDigest": "04f91d1ea99dec436b52b887867f39cb5319d25da58e78eaab647699f79b3cf1",
  "reviewerId": "reviewer-a",
  "reviewerKind": "independent_human",
  "independenceStatement": "Labelled blind, without system or model outputs.",
  "labels": [
    {
      "itemId": "<from the template>",
      "label": "supported",
      "evidenceInspected": ["retained register row", "register portal"],
      "rationale": "County and locality match the certificate.",
      "seconds": 40
    }
  ]
}
```

Record `seconds` honestly; it is the measured review cost per fact. The
adjudication file follows `adjudicationSchema` (corpus digest, adjudicator id,
one decision per disputed item).

## Workload

Holdout: 413 items, each labelled by two reviewers (826 judgements). Calibration:
339 items by one reviewer plus at least 85 double-reviewed. About 1,250
judgements in total, plus adjudication; the 72 development items need no labels.
Lower-risk items are expected to be quick, but no review time has been measured.
