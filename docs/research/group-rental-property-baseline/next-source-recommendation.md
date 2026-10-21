# Next source recommendation

Status: recommendation for the next **investigation**, not authorisation to
build an adapter or scraper. Every claim about a new source below is a
hypothesis that its own experiment must measure.

Follow-up: the [controlled Overture experiment](../next-source-value/README.md)
now records actual sample results and an **investigate further** decision.
The expectations below are the original hypotheses, not established gains.

## What the baseline showed

Figures are from the [quality report](./quality-report.md) (observed,
unverified):

1. **Neither source can make a Candidate in scope.** Rental mode (whole
   property) and event suitability are absent from both. Every one of the
   15,297 plausible/ambiguous register Candidates and 5,276 plausible/ambiguous
   OSM Candidates still needs external evidence.
2. **OpenStreetMap is not a coverage backbone.** Only 9.6 % (likely) to
   23.3 % (any suggestion) of the register's plausible/ambiguous population
   reconciles with OSM, and as little as 4–7 % in counties such as Bihor,
   Maramureș, and Constanța at the `likely` tier.
3. **Supply exists outside the register.** 2,705 plausible/ambiguous OSM
   Candidates have no register suggestion of any strength: unregistered
   properties, properties the register names differently, or matcher misses.
   Their split is unknown until review.
4. **Small properties live on Facebook.** Only 9.6 % of register rows and 19 %
   of OSM objects carry a website; `facebook.com` is the most frequent website
   domain among Claims (856 pages), ahead of every operator domain.
5. **The register lacks a usable contact channel.** 82 % of its emails are
   free-mail (personal, withheld), it has no phones, and it has no coordinates.

## Candidate source families

| Family                                                               | New in-scope properties (expected)                                   | Overlap with A+B                       | Additional attributes                                                                                 | Unique discovery                          | Reuse rights                                                                                                                      | Acquisition cost    | Integration                                                                | Maintenance                                | Freshness        |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| **Overture Maps Places** (Meta, Microsoft, Foursquare, and others)   | Medium–high: likely covers Facebook-page-only businesses (finding 4) | Partial; places are not drawn from OSM | Categories (lodging subtypes), websites, social profiles, phones, addresses, confidence scores        | Yes, via Meta/Microsoft business listings | CDLA-Permissive-2.0 for most contributors (some Apache-2.0, CC0); joining with OSM may make a derivative database subject to ODbL | Free bulk download  | Moderate: GeoParquet needs a Parquet reader (a new, documented dependency) | Low: monthly releases with stable GERS ids | Monthly          |
| **Operator websites and pages** (URLs from A, B, and later Overture) | None (enrichment, not discovery)                                     | Full: same properties                  | Whole-property rental, capacity, prices, house rules, event policy (the missing eligibility evidence) | No                                        | Per site: terms and robots must be checked; personal data on owner pages                                                          | Fetch cost per page | High: heterogeneous pages (experiment ladder steps 1–2)                    | High: pages change                         | Live             |
| Booking, Airbnb, Travelminit, national rental portals                | High                                                                 | High                                   | Rental mode, capacity, prices, reviews                                                                | Yes                                       | Terms prohibit automated collection and reuse                                                                                     | Partnership only    | High                                                                       | High                                       | Live             |
| Google Places API                                                    | High                                                                 | High                                   | Phones, websites, opening hours                                                                       | Yes                                       | Terms restrict storing Places content beyond short-term caching; unsuitable as a database source                                  | Paid per request    | Low                                                                        | Low                                        | Live             |
| Company registers (ONRC/ANAF, CAEN 5520)                             | None (Providers, not properties)                                     | Matches register tax ids               | Legal status of operators                                                                             | No                                        | Public; personal data for sole traders                                                                                            | Low                 | Moderate                                                                   | Low                                        | Varies           |
| INS accommodation statistics                                         | None (aggregates)                                                    | —                                      | Reference counts by county and type                                                                   | No                                        | CC-BY-4.0                                                                                                                         | Free                | Low                                                                        | Low                                        | Annual / monthly |

## Recommendation

**Investigate Overture Maps Places for Romania next**, as a third discovery
source measured with the same baseline machinery.

Why it beats the alternatives on the baseline evidence:

- It targets the measured gap: properties outside the register and outside
  OSM (finding 3), especially those whose only web presence is a Facebook page
  (finding 4).
- It is the only discovery source with open reuse terms at national scale;
  listing platforms and Google Places are blocked by their terms.
- Stable GERS identifiers and monthly releases fit the Evidence model
  (versioned artifacts, source-native keys, change detection later).
- It supplies websites and social profiles, which are the inputs for the
  second-priority experiment below.

What the experiment must measure before any adapter is accepted:

1. Romanian lodging records by category and confidence, and how many fall
   into plausible/ambiguous screening.
2. Incremental plausible/ambiguous Candidates not suggested in A or B, split
   by independent review into new properties versus matcher misses.
3. Overlap with the 2,705 OSM-only Candidates.
4. Website and social-profile completeness for in-scope Candidates.
5. The per-record licence and source fields, and a legal answer on combining
   Overture data with OSM-derived Claims in one database (ODbL share-alike).

**Second priority — operator websites for eligibility.** Coverage is
necessary but not sufficient: without whole-property and event evidence, no
Candidate can be published. Once Overture has been measured, run experiment
ladder steps 1–2 ([data acquisition experiments](../../product/data-acquisition-experiments.md))
on the websites of reconciled plausible Candidates to measure how often owner
pages state exclusive rental and event rules.

## Not recommended now

Scraping listing platforms, Google Places storage, and general web crawling:
the first two are excluded by their terms, and crawling is a non-goal of this
baseline. Company registers and INS statistics are useful later for Provider
resolution and as an external reference population, not for discovering
properties.

Sources: Overture Maps [Places guide](https://docs.overturemaps.org/guides/places)
and [FAQ](https://overturemaps.org/about/faq/) (licensing and contributors,
checked 2026-10-21). Platform and Google Places terms must be confirmed by
legal review before relying on this assessment.
