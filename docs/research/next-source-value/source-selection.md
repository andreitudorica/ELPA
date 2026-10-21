# Source selection and commercial-use boundary

Checked on 2026-10-21. This memo distinguishes observed source content from
untested expectations. Only Overture is acquired by the implemented adapter;
the other pages were inspected as shortlist examples and retained as references.
No owner, directory, or prospective partner was contacted.

## Shortlist grounded in original records

| Family and inspected reference                                                                                                                                                                         | Observed material                                                                                                                                | Discovery / overlap hypothesis                                                                                              | Geography and freshness                                                                                   | Engineering, maintenance, cost                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Independent operator websites: [example](https://cabana1407.ro/) and its linked rental policy                                                                                                          | Explicit whole-rental text, sleeping capacity, covered outdoor area, barbecue and hot-tub descriptions                                           | High depth for already linked properties; discovery depends on a separate frame. Overlap not measured                       | One Sibiu example, not national evidence; live page has no dependable field-level observation dates       | Heterogeneous HTML/PDF, per-site permission and change handling; cash price unknown, high maintenance expectation    |
| Romanian tourism directories: [example listing](https://www.turistinfo.ro/sura_mare/cazare-sura_mare/cabana_grosser_raw-c125793.html)                                                                  | A source-native listing id, whole-rental description, capacity and amenity lists                                                                 | Promising depth and discovery; overlap not measured                                                                         | One Sibiu example; availability UI is not proof of current amenity accuracy                               | Structured presentation but no acquired feed or licence; integration/access costs unknown                            |
| Event/team-building directories: [locations](https://www.teambuilding.ro/locatii)                                                                                                                      | Activities linked to destinations, including locations outside Romania; not a clean inventory of independently bookable properties               | Potential event context, weak property granularity in this inspected example; overlap unknown                               | Several destinations, mixed domestic/international; no source-record update time observed                 | Manual disambiguation needed; feed terms, cost and refresh contract unknown                                          |
| Destination organisations: [accommodation example](https://visitharghita.com/ro/places/dorka-panzio) and [terms](https://visitharghita.com/pages/terms-of-use/fragment)                                | Separately rentable houses inside a larger complex, capacity and event-oriented descriptions                                                     | Strong enrichment hypothesis, but a complex is not automatically one Offer; overlap unmeasured                              | Harghita only in this inspection; no reliable per-field freshness                                         | Destination-specific schema and permissions; potentially moderate maintenance; no commercial licence quote obtained  |
| Licensed Places datasets: [Overture schema](https://docs.overturemaps.org/schema/reference/places/place/), [access method](https://docs.overturemaps.org/getting-data/duckdb/), and the acquired frame | Native ids, versions, coordinates/bounds, categories, names, websites/socials, address and contributor metadata; no priority event/rental fields | Test discovery and identity enrichment; do not assume eligibility enrichment or independence from operator-supplied content | Fixed September release; national bounding frame, uneven metadata; release date is not property freshness | Fixed-release SQL plus a small JSON adapter; no paid API purchased. Schema/provider drift still requires maintenance |

These few original records demonstrate available kinds of data, not the
representativeness or commercial permission of an entire family. No quantitative
overlap estimates are assigned to families that have not been imported.

## Access is not a licence to build a commercial database

| Family                   | Access                                                       | Process and retain                                                        | Enrich / reconcile                                                                                 | Republish                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator websites        | Ordinary public browsing worked                              | No general commercial data-retention permission established               | Permission remains site-specific                                                                   | No blanket redistribution grant found; images and prose are excluded                                                                                    |
| Tourism directory        | Public example readable; attempted terms URL was unavailable | No feed agreement or applicable reuse grant established                   | Unresolved                                                                                         | Unresolved; do not interpret lack of a retrieved prohibition as permission                                                                              |
| Event directory          | Public locations page readable                               | No commercial database licence established                                | Unresolved                                                                                         | Unresolved                                                                                                                                              |
| Destination organisation | Public page readable                                         | Terms require owner permission or a legal basis for content use           | Unresolved for ELPA's commercial database                                                          | No blanket grant; the fact that a public authority operates the site does not settle third-party content rights                                         |
| Selected Overture subset | Documented anonymous bulk Parquet access                     | CDLA permits data use and modification; retain a versioned local snapshot | Permitted by the selected data licence; reconciliation does not override other inputs' obligations | Sharing selected data requires accompanying licence text. OSM-derived database/publication obligations remain a separate unresolved production boundary |

The operative sources are [Overture attribution](https://docs.overturemaps.org/attribution/)
and [CDLA-Permissive-2.0](https://cdla.dev/permissive-2-0/). This is a recorded
operational permission assessment, not a conclusion that data licences waive
privacy, trademark, or other third-party rights. The experiment withholds email
and phone fields and does not redistribute raw records in this public repository.

The actual frame contained four provider combinations: Meta + Overture (21,532),
Microsoft + Overture (79), Foursquare + Overture (95), and AllThePlaces + Overture
(10). This experiment admits only the first two, with explicit CDLA licence
metadata or the documented provider-level fallback. Apache/CC0 records are
excluded to keep one reviewed permission profile, not because those licences are
inherently incompatible. An unknown provider or conflicting explicit licence
fails the adapter before Evidence is retained.

## Selection

Choose **Overture Places as one licensed-dataset family**, provisionally for a
discovery experiment. Its accessible versioned records and explicit permission
profile let ELPA test marginal value without assuming scraping rights or buying
a feed. The baseline's prior recommendation is supported on access and licensing,
but its discovery claim remains a hypothesis. The other four families offer
potentially greater attribute depth; absent permission and a bounded feed/frame,
they cannot be silently acquired as part of this experiment.

No partnership is implied. No linked operator page is fetched for extraction.
The source's lack of priority fields and poor county metadata are results to
report, not reasons to broaden acquisition during the frozen experiment.
