# Primary source analysis

Examined on 2026-10-20/21 from the original downloads. All counts below were
computed from those artifacts; none are taken from aggregated summaries.

## Source A — Official register of classified accommodation (DGT / SITUR)

### Access and datasets

The Directorate-General for Tourism (Ministerul Economiei, Antreprenoriatului
și Turismului) publishes open lists at
<https://se.situr.gov.ro/OpenData/OpenDataMain>. Each list is rendered as an
HTML page (about 21.6 MB for accommodation) with an **Excel export**
(`/OpenData/ExportToExcel?type=…`). Relevant lists, all stamped "Ultimul
update: 21.10.2026":

| List (`type`)        | Content                                                    | Rows (21.10.2026) | Extra column |
| -------------------- | ---------------------------------------------------------- | ----------------- | ------------ |
| `listaCazari`        | Classified accommodation structures (current certificates) | 32,231            | —            |
| `listaCazariRadiate` | Certificates deregistered (_radiate_)                      | 4,783             | `Motivație`  |
| `listaCazariRetrase` | Certificates withdrawn (_retrase_)                         | 21                | `Motivație`  |

Only `listaCazari` is imported. The deregistered and withdrawn lists were
analysed but not imported (see limitations).

**Versioning.** The workbook's first row states the update date
(`… ACTUALIZATĂ LA 21.10.2026`); the adapter reads it as the dataset version.
The export is **regenerated on every download**: two downloads of the same
version had different SHA-256 checksums (`d4854cff…` and `1765427e…`) but
identical content. Artifact checksums therefore identify a file, not a
dataset version; record-level content checksums identify unchanged records.
The server's `Date` header was observed about 29 minutes ahead of the client
clock, so retrieval time is taken from the client.

### Fields (`listaCazari`, 18 columns)

| Column                                     | Filled         | Meaning and use                                                               |
| ------------------------------------------ | -------------- | ----------------------------------------------------------------------------- |
| Tip unitate                                | 100 %          | Structure type (19 values) → `offer.registry_structure_type`                  |
| Nume unitate                               | 100 %          | Structure name → `offer.name`                                                 |
| Tip categorie                              | 100 %          | Stars/flowers/daisies classification → `offer.registry_classification`        |
| Număr spații                               | 99.9 %         | Rooms/units in the certificate → `offer.units_count`                          |
| Număr locuri                               | 99.9 %         | Accommodation places → `offer.sleeps_persons`                                 |
| Alte detalii adresă                        | 92.4 %         | Street, number, block, apartment → `offer.address`                            |
| Tip localitate / Localitate componentă     | 99.4 % / 52 %  | Settlement kind and administrative unit                                       |
| Localitate                                 | 99.8 %         | Hierarchical locality (`Com. Bran, Sat Bran`) → `offer.primary_locality`      |
| Județ                                      | 100 %          | County (15 rows empty)                                                        |
| Email                                      | 73.2 %         | Contact email; 82 % free-mail (personal) — **not stored**                     |
| Web                                        | 9.6 %          | Website, often a Facebook page → `offer.website`                              |
| Tip Operator Economic                      | 77.0 %         | Operator legal form → `provider_hint.kind`                                    |
| Operator Economic                          | 99.9 %         | Operator name; a natural person for PFA/II/IF or empty type                   |
| Număr Înregistrare / Cod Unic Înregistrare | 75 % / 77 %    | Trade-register number and tax id (CUI) → `provider_hint.*` for legal entities |
| Număr autorizație / Dată emitere           | 100 % / 99.9 % | Classification certificate number and issue date                              |

**No coordinates, no phone numbers, no capacity per bed type, no rental
mode, no event policy.** Structure types: _camere de închiriat_ 12,376;
_apartamente de închiriat_ 8,340; _pensiune turistică_ 4,902; _hotel_ 1,801;
_pensiune agroturistică_ 1,720; _vilă turistică_ 1,022; _hostel_ 566;
_căsuțe tip camping_ 480; _cabană turistică_ 269; _motel_ 220; _camping_ 187;
_bungalouri_ 173; and seven smaller types.

### What a row identifies

A row is a **classification certificate** — an administrative certification
of one classified structure — not a property and not an operator:

- certificate numbers are **not unique**: 32,025 distinct numbers in 32,231
  rows; 620 numbers of deregistered certificates reappear in the current list;
- one property can hold several certificates (e.g. rooms and camping cabins in
  one complex, or a re-classification with a new date);
- one operator (tax id) holds several certificates: 2,870 tax ids cover 8,494
  rows, the largest 156;
- there is **no stable source-native row identifier**. Even
  (certificate, date, type, name) collides in 6 rows, and 16 rows have no
  certificate number.

The adapter therefore derives `cert:<number>|<date>|<hash of type, name,
county, locality>`, disambiguating fully identical identities with `#n`
ordered by content checksum. Changing an identity field produces a new key;
this stability across register versions is **unmeasured** (one version
observed) and is listed as an unknown.

### Duplicates and history

62 rows repeat (type, name, locality, county, certificate) with differences in
other fields (e.g. a renewal with a new date and a corrected operator name).
670 deregistered (name, locality) pairs also appear in the current list,
showing re-classification history. Deregistration reasons are request numbers
or approval reports; they do not state why a property closed.

### Reuse conditions and retention

- The portal states **no licence or reuse terms**. The register is public
  sector information; Romanian law transposing the EU Open Data Directive
  (Directive (EU) 2019/1024) generally permits reuse of published documents,
  but **personal data are excluded from that permission** and remain subject
  to the GDPR. Recorded as `ro_public_register_no_explicit_licence`; a legal
  review is required before production use or redistribution.
- 8,303 rows have an operator that may be a natural person (empty type or
  PFA/II/IF), whose name, registration number, and tax id are personal data.
- Retention policy `personal_data_redacted`: the full row is checksummed, but
  `Email` is withheld for every row, and operator name, registration number,
  and tax id are withheld for non-legal-entity operators. Only the business
  email domain (non-free-mail) is kept as a Claim.
- Because the repository is public, **no register rows are committed**: test
  fixtures must be synthetic and evaluation exports live in an ignored local
  directory.

### Suitability

High-trust existence and capacity data with national coverage of _classified_
structures, but no geometry and no rental-mode information. Classification
does not imply suitability for group rental or events.

## Source B — OpenStreetMap Romania (Geofabrik extract)

### Access and versions

<https://download.geofabrik.de/europe/romania.html> serves
`romania-latest.osm.pbf` (redirects to a dated file) plus Shapefile and
GeoPackage variants. The baseline uses the dated PBF
`romania-261019.osm.pbf`: 331,099,272 bytes, MD5 `5176524c…` (matches the
published `.md5`), SHA-256 `9eff756d…`. Header: required features
`OsmSchema-V0.6`, `DenseNodes`; written by osmium 1.16.0; **replication
timestamp 2026-10-19T20:21:11Z** (sequence 4942), used as the dataset version.
Geofabrik strips user names, user ids, and changesets; object version and
timestamp remain and are preserved.

The PBF was chosen over the "free" Shapefile/GeoPackage layers because those
reduce objects to a class code and name and drop the original tags.

### Contents relevant to accommodation

41.2 M nodes, 4.4 M ways, 67 k relations. `tourism=*` accommodation values:

| Value          | Nodes | Ways  | Relations | Imported                                |
| -------------- | ----- | ----- | --------- | --------------------------------------- |
| guest_house    | 3,432 | 1,316 | 16        | yes                                     |
| hotel          | 1,721 | 1,558 | 26        | yes                                     |
| apartment      | 695   | 42    | —         | yes                                     |
| camp_site      | 448   | 159   | —         | yes                                     |
| chalet         | 174   | 247   | 1         | yes                                     |
| hostel         | 267   | 108   | 2         | yes                                     |
| motel          | 235   | 139   | —         | yes                                     |
| alpine_hut     | 108   | 121   | —         | yes                                     |
| wilderness_hut | 48    | 36    | —         | no — unstaffed shelters, never rentable |
| camp_pitch     | 78    | 2     | —         | no — a pitch, not a property            |
| caravan_site   | 16    | 4     | —         | no — no accommodation building          |

A handful of non-standard values (`cabin`, `pension`, `holiday_cottage`, …;
under 15 objects) are not imported. 170 accommodation objects in the extract
lie outside Romania's county boundaries and are excluded.

Tag completeness among accommodation objects: `name` 9,754; `addr:city`
4,418; `addr:street` 3,930; `addr:housenumber` 3,497; `phone` 2,690; `website`
1,940; `stars` 1,106; `email` 864; `rooms` 550; `operator` 317; `beds` 79;
`capacity` 60; `ref:vatin` (tax id) about a dozen.

### Identity, geometry, and multi-unit sites

OSM objects have native, stable identifiers (`node/…`, `way/…`,
`relation/…`) and versions. A property is mapped as a point or as a building
or site outline; the same property is sometimes mapped twice (node and
building). A camp site or chalet complex is usually one way or relation
without per-unit objects, so OSM rarely separates the Offers inside a
complex. Ways keep their node references and resolved coordinates; the
representative point is the vertex mean (accuracy well within a building or
plot).

County and settlement are not tagged consistently, so they are **inferred
from the same snapshot**: county by point-in-polygon against the 42
`admin_level=4` boundaries carrying `ISO3166-2` (`RO-AB` … `RO-B`), and
settlement from `addr:*` tags (41 %) or the nearest `place=*` node within a
type-specific radius (city 12 km, town 6 km, village 5 km, hamlet/suburb
2 km). These are recorded as inferred Claims with the boundary relation and
place node ids as inputs.

### Licence

Open Database License 1.0. Obligations relevant to ELPA:

- **Attribution**: "© OpenStreetMap contributors, ODbL 1.0" wherever OSM-
  derived data is shown publicly.
- **Share-alike for derivative databases**: a database that combines OSM data
  with other data (for example reconciled Candidates) is a derivative database;
  if it is publicly used, it must be offered under ODbL. Publishing produced
  works (maps, recommendations) does not by itself require releasing the
  database, but the boundary between a produced work and substantial
  extraction needs a legal decision before the Recommendation Product exposes
  OSM-derived fields.
- Retention policy `full_record`: original tags (including contributor-entered
  phone and email) are retained as Evidence; email is reduced to a business
  domain in Claims.

### Suitability

Precise geometry, many websites and phone numbers, and properties absent from
the register; incomplete and uneven coverage (volunteer mapping), little
capacity data, and no rental-mode or event information.

## Comparison

| Aspect               | Register (A)                          | OpenStreetMap (B)                   |
| -------------------- | ------------------------------------- | ----------------------------------- |
| Records in Romania   | 32,231 certificates                   | 10,645 accommodation objects        |
| Native identifier    | none (derived key)                    | stable type/id + version            |
| Geometry             | none                                  | 100 %                               |
| Capacity             | 99.9 % (per certificate)              | under 6 % (rooms), under 1 % (beds) |
| Website              | 9.6 %                                 | 19 %                                |
| Operator identity    | tax id 73 % (legal entities)          | rare                                |
| Rental mode / events | absent                                | absent                              |
| Reuse terms          | none stated; personal data restricted | ODbL 1.0                            |
| Version signal       | update date in the file               | replication timestamp in the header |

## Alternatives considered for this baseline

- INS (National Institute of Statistics) publishes aggregate accommodation
  capacity statistics on data.gov.ro under CC-BY-4.0. They are counts, not
  records, so they can serve as an external reference population later but
  cannot be reconciled.
- The register's HTML listing contains the same data as the export; the
  export was used because it is the published machine-readable form.
