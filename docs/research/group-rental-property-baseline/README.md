# Group Rental Property acquisition baseline

The first measurable, reproducible acquisition experiment for ELPA's Romanian
Group Rental Property research population. Its claim is not "we imported many
properties", but:

> We can show where every record came from, how it was interpreted, which
> records may be the same real-world property, what we have not discovered,
> and how we will know whether the next source improves the database.

## Deliverables

|     | Deliverable                         | Where                                                                                                                          |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A   | Population definition and rubric v1 | [population-definition.md](./population-definition.md)                                                                         |
| B   | Primary source analysis             | [source-analysis.md](./source-analysis.md)                                                                                     |
| C   | Working acquisition slice           | `apps/api/src/research/` (Acquisition Runs, Evidence, Claims, Candidates), [`apps/api/README.md`](../../../apps/api/README.md) |
| D   | Cross-source matching baseline      | [entity-resolution.md](./entity-resolution.md), `apps/api/src/research/matching/`                                              |
| E   | Ground-truth evaluation protocol    | [evaluation-protocol.md](./evaluation-protocol.md), [sample manifest](./data/evaluation-sample-1.manifest.json)                |
| F   | Quantitative quality report         | [quality-report.md](./quality-report.md), [report JSON](./data/acquisition-report.json)                                        |
| G   | Data Studio visibility              | `/studio/research-campaigns/:campaignId` (runs, report, Candidates, duplicate suggestions) and the Candidate page              |
| H   | Reproduction instructions           | [reproduction.md](./reproduction.md)                                                                                           |
| I   | Next source recommendation          | [next-source-recommendation.md](./next-source-recommendation.md)                                                               |

## Starting point and smallest coherent change

Before this change the Research module stored Research Campaigns (one county,
Group Rental Property, Romania) and their investigated source URLs, audited by
the Audit module. Candidates, Evidence, Claims, and Acquisition Runs existed
only in the conceptual data model; Curation and Recommendation were empty
modules; Catalog held Categories only. The API followed the module, Zod
contract, CLS transaction, and boot-time admin-route conventions of ADRs
0020–0022.

The smallest change that allows a real acquisition experiment, kept inside the
Research boundary:

1. **Source Artifacts and Acquisition Runs** — every attempt is recorded with
   its artifact checksum, dataset version, parser and normalizer versions,
   status, statistics, failure, and output digest.
2. **Evidence** — one immutable row per distinct source-record content, with
   retention-policy redaction; per-run record outcomes are kept separately so
   re-interpretation never alters Evidence.
3. **Candidates and proposed Claims** — campaign-scoped, unverified by
   database constraint, each Claim pointing to its Evidence and the source
   field (or inference policy) it came from.
4. **Duplicate Suggestions** — explainable, versioned, never merging.
5. **A research CLI** for the long-running imports (no queue or worker; ADR
   0014), read-only Data Studio endpoints and pages, and a national campaign
   scope (`county` optional).

Not touched: canonical Providers, Offers, and Operating Locations (Catalog),
Verification and Publication (Curation), and everything the Recommendation
Product reads. No Candidate becomes Verified or Published.

## Results in one paragraph

Both priority sources were imported end to end: 32,231 register certificates
(15 rejected) and 10,645 OSM accommodation objects, with stable digests
across repeated runs and byte-different downloads. The matcher compared
465,426 pairs and proposed 11,666 suggestions. Of 15,297 register Candidates
screened plausible or ambiguous, 9.6 % reconcile with an OSM `likely`
counterpart and 23.3 % with any suggestion. OSM contributes 2,705 plausible or
ambiguous Candidates with no register counterpart. Between 34,360 and 39,850
distinct properties are estimated among 42,861 Candidates. All of this is
unverified, and matching accuracy is **not measured** until independent review
of the 352-item sample is complete.

## Status of the acceptance criteria

| #   | Criterion                                                      | Status                                                                                                                                  |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A legally usable Romanian dataset imported end to end          | Done: OSM (ODbL) and the register; register reuse terms need legal confirmation                                                         |
| 2   | Second source analysed and comparatively imported              | Done: both sources imported and compared                                                                                                |
| 3   | Source identity and permitted Evidence preserved               | Done: native/derived keys, checksums, redacted personal data                                                                            |
| 4   | Fixed inputs produce reproducible outputs                      | Done: one output digest per source across runs                                                                                          |
| 5   | Repeated imports are idempotent                                | Done: 0 new rows on repeat, including a byte-different download                                                                         |
| 6   | Claims traceable to source observations                        | Done: Claim → Evidence → artifact, with field or policy locators                                                                        |
| 7   | Candidates unverified and unpublished                          | Done: enforced by CHECK constraints and API literals                                                                                    |
| 8   | Explainable cross-source relationships                         | Done: signals and decision rules stored per suggestion                                                                                  |
| 9   | Evaluation cases independently inspectable                     | Protocol, blind sheet, and scorer done; **review not yet performed**                                                                    |
| 10  | Metrics from actual records                                    | Done for ingestion, completeness, overlap, and coverage; ER metrics pending labels                                                      |
| 11  | Record counts, unique estimates, verified counts distinguished | Done: labelled observed / estimate / not verified                                                                                       |
| 12  | Licensing and retention recorded                               | Done: per artifact and in the source analysis                                                                                           |
| 13  | Data Studio exposes the experiment                             | Done (typechecked and linted; not checked in a browser in this change)                                                                  |
| 14  | Automated tests and repository checks pass                     | **Partial**: lint, typecheck, build, migration and OpenAPI checks pass; automated tests for the slice were deferred by decision for now |
| 15  | Docs separate implemented from planned                         | Done: this table and the "Not touched" list                                                                                             |

## Decisions and flags raised by this work

- **National Research Campaigns.** `county` is now optional; null means all of
  Romania. A locality still requires a county.
- **Public repository.** Register rows, review sheets, and artifacts are never
  committed; only aggregates, key-only manifests, and synthetic fixtures may
  be.
- **Glossary conflict** on exclusive-rental guesthouses (_pensiune_), recorded
  in the population definition and in `UBIQUITOUS_LANGUAGE.md`.
- **Legal review needed** for register reuse and personal data, and for
  combining ODbL data with other sources in a publicly used database.
- **Drizzle `jsonb` coercion.** The built-in column re-parsed JSON strings
  (tax id `"10013733"` became a number); Claim values use an exact `jsonb`
  column type (`apps/api/src/database/json-column.ts`).
