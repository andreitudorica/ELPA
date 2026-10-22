# Automatic verification policy `elpa-verification-policy@1`

Source of truth: [`policy.ts`](../../../apps/api/src/curation/verification/policy.ts)
and [`data/policy.json`](./data/policy.json). A change to any rule, gate or
category needs a new policy version; earlier decisions remain as history.

## States, methods and dimensions

Only two of the eight requested notions are new stored records. The others are
existing records, derived views, or metadata on a decision.

| Notion                    | What it is in ELPA                                                                                    | Stored where                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Raw Evidence              | Immutable source snapshot (existing)                                                                  | Research `evidence`                                |
| Extracted Claim           | Immutable proposed value with locator and method version (existing)                                   | Research `claim`                                   |
| Reconciled assessment     | Immutable comparison of Claims (existing, ADR 0024)                                                   | Research `reconciliation_assessment`               |
| Machine-verified fact     | Verification Decision, outcome `verified`, method `machine_policy`, with an approved eligibility      | Curation `verification_decision`                   |
| Human-confirmed fact      | Verification Decision, outcome `verified`, method `administrator`, with an audited reason             | Curation `verification_decision`                   |
| Owner-confirmed fact      | Verification Decision, method `owner_confirmation` — reserved; no owner-statement Evidence source yet | Not implemented (database refuses the method)      |
| Publication-eligible fact | Derived: current verified decision whose method the category accepts and whose source terms allow it  | Not stored; shown as "publication blocked" reasons |
| Published catalog fact    | A separate future Curation decision over canonical Offers                                             | Not implemented                                    |

Verification method and risk category are **dimensions** of one decision, not
separate states. A decision always keeps its Claim, Evidence identifiers, the
validation snapshot, the advisory assessment (when used), follow-up actions,
policy and validator versions, the reasons, the as-of time and the acting
Administrator (for machine runs, the Administrator who started the run).

## Risk categories

| Category                       | Risk     | Proposition verified                                                                    | Corroboration   | Model assessor | Autonomy   | Publication may accept |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------- | --------------- | -------------- | ---------- | ---------------------- |
| `register_locality`            | lower    | County and locality of a classified unit in the official register                       | not required    | not needed     | after gate | machine, Administrator |
| `osm_county`                   | lower    | County containing an OSM object by boundary containment (not settlement)                | not required    | not needed     | after gate | machine, Administrator |
| `register_classified_capacity` | lower    | Official classified places ("Număr locuri") — never maximum group size                  | not required    | not needed     | after gate | machine, Administrator |
| `explicit_text_facility`       | moderate | Explicitly described barbecue, lawn, sauna, hot tub, recreation…                        | not required    | **required**   | after gate | machine, Administrator |
| `property_shape_count`         | moderate | Beds, rooms, bedrooms, bathrooms stated by a source                                     | **independent** | advisory       | after gate | machine, Administrator |
| `high_consequence`             | higher   | Guest or event capacity, whole rental, party permission, pool availability, noise rules | independent     | advisory       | **never**  | Administrator, owner   |

Why these lines:

- An official structured register field is the authority for what the register
  says; the remaining risks are parsing, identity and staleness, which
  deterministic checks address. The register's "Număr locuri" counts
  _classified places_; using it as group size is a separate, high-consequence
  proposition.
- County containment is geometric and checkable; the nearest-place settlement
  inference is not verified at all.
- Text facilities need semantic judgement (negation, shared/public facilities,
  seasonality), so the model assessment is required, never sufficient alone.
- Crowd-sourced counts carry no edit date, so they need independent
  corroboration, which no current source provides.
- Permission, exclusivity, capacity for events and availability decide whether a
  User's plan works. The policy keeps them out of autonomy regardless of any
  evaluation; an Administrator or a future recent owner confirmation decides.

Freshness windows: 365 days for structural facts, 180 days for high-consequence
rules (aligned with the Group Rental Property freshness policy).

## Deterministic evidence validator

`elpa-evidence-validator@1` runs before any model and records every check:

| Check                    | Pass condition                                                                                                                                     | On failure                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `evidence_exists`        | The Claim's Evidence snapshot is present and matches                                                                                               | reject                      |
| `processing_permitted`   | Known reuse terms and retention policy; publication constraints recorded (register terms pending legal review, ODbL share-alike, CDLA attribution) | reject                      |
| `source_reference_valid` | Structured fields present and readable (empty optional fields allowed), text span re-validated, inference policy and inputs present                | reject                      |
| `support_present`        | A supporting value or quote exists                                                                                                                 | reject                      |
| `identity_established`   | Claim, Candidate and Evidence share the source record identity                                                                                     | reject                      |
| `scope_correct`          | Offer-level advertised accommodation; ambiguity or unknown capacity basis is a warning                                                             | reject / defer              |
| `value_normalized`       | Valid ISO county code and named settlement; counts are integers 1–2000; assertions are non-empty                                                   | reject                      |
| `temporal_context`       | Current method, latest Evidence, latest dataset version; temporal qualifiers or staleness are warnings                                             | reject (superseded) / defer |
| `contradictions_checked` | No differing same-category Claim on the record; a conditional conflict from an equally or more authoritative counterpart defers                    | contradict / defer          |
| `independence_assessed`  | Agreeing Claims are classified common origin, possibly common origin or unknown; never counted as independent without evidence                     | defer where required        |

Duplicate Suggestions are unreviewed, so every cross-Candidate comparison is
**conditional**. Different source families are "independence unknown", because
OSM mappers may copy the register. Model transfer is allowed only for the three
text sources, and only for allowlisted, contact-filtered fields; image Evidence
is never sent.

## Advisory AI assessor

Prompt `elpa-evidence-assessor-prompt@1`
(SHA-256 `576256527fc1961f1ccbd5079d019c0dbe556bf14c780112f3c1d4c0c8e3061f`),
frozen after the development split. The request contains the proposition and
its criteria, the property name and source record key, the observation time and
dataset version, and evidence passages under opaque references (`E1`, `E2`, …),
including conflicting or agreeing counterparts with their role. It forbids general
world knowledge and does not ask for confidence.

Required structured output: verdict (`supported`, `contradicted`,
`insufficient_evidence`, `incorrect_entity_attribution`, `uncertain`), rationale,
supporting and contradicting reference lists, verbatim supporting quotes and
concerns. The deterministic validator of captures rejects schema violations,
invented references, quotes not found verbatim in the cited passage, support
without citation, contradiction without citation and over-long rationales.
Captures record provider, requested and served model, prompt version and hash,
parameters, stop reason, latency, input/output/cache tokens and cost. The
provider-neutral port (`EvidenceAssessorModel`) has one adapter
(`claude-sonnet-5-5`, effort `low`, adaptive thinking, structured outputs, no
refusal fallback so every item is judged by the pinned model). The adapter never
writes; a refusal or call failure is an unavailable assessment.

## Decision engine

For each strategy the engine yields a **recommendation** and a gated
**outcome**:

1. No category → not eligible. Rejected validation → insufficient evidence (or not
   eligible if the Claim is superseded). Contradicted → contradicted.
2. High-consequence → not eligible (`category_never_autonomous`).
3. Deferred validation → further research required, unless the selective strategy
   ran bounded follow-up that resolved (or contradicted) it.
4. Where the strategy uses the assessor: missing or rejected assessment → further
   research; `contradicted` or `incorrect_entity_attribution` → contradicted;
   `insufficient_evidence` → insufficient evidence; `uncertain` → further research.
   A required assessment that the strategy does not run → further research.
5. Otherwise the recommendation is `auto_verify`. The outcome is `verified` only if
   an approved eligibility exists for the category **and** the item's evidence
   score reaches the threshold selected on the calibration split; otherwise
   `not_eligible` with `category_gate_not_passed` or `below_calibrated_threshold`.

The **evidence score** (0–5) is an ordinal count of independent signals: clean
validation, no conflicts, authoritative source, cross-source agreement and an
accepted supporting assessment. It is not a probability; calibration maps it to
empirical correctness on labels.

Strategies: **A** deterministic only; **B** deterministic plus the assessor on
every item; **C** (operational) deterministic, the assessor only where the
category needs it, and bounded follow-up for deferred items. Only C's decisions
are persisted; A and B are computed for comparison from the same captures.

## Bounded follow-up research

`elpa-follow-up-research@1` applies only to OSM-county items deferred solely by
a conditional conflict. Actions, in order: reread allowlisted address tags of the
retained Evidence; consult existing register counterparts; request a new
observation (always `not_permitted`: no authorized adapter). Limits: three
actions, zero network calls, zero cost, permitted sources "retained Evidence" and
"existing register Candidates", duplicate actions skipped by fingerprint.
Termination: `resolved` when the retained record explicitly states the same
county, `contradicted` when it states another, otherwise `exhausted` — the fact
stays unknown. Operator websites and live sources are excluded until their
permission is reviewed.

## Administrator override

An Administrator may supersede any current decision with `verified`, `rejected`
or `insufficient_evidence` and a reason of at least ten characters. The override
is a new Administrator decision, audited as `verification.overridden`; the
superseded decision remains visible. Administrators are never required to
approve automatically eligible facts.
