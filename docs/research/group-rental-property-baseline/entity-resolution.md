# Entity resolution baseline (matcher v1)

Version identifier: `grp-duplicate-matcher@1`
(`apps/api/src/research/matching/duplicate-matcher.ts`). The matcher is
deterministic, rule-based, and explainable. It produces **Duplicate
Suggestions**; it never merges Candidates, never creates canonical Providers
or Offers, and never marks anything verified.

## What is being matched

- **Same property**: two Candidates describe the same real-world property (a
  register certificate and an OSM object, two OSM objects for one building, or
  two register rows for one property).
- **Same provider**: two Candidates are probably operated by the same
  Provider but are not shown to be the same property.

Provider-level identifiers — tax id, own website domain, business email
domain — are evidence for the second relation only. One operator with several
rental units must never collapse into one property because units share an
operator or website.

## Inputs

The matcher reads only current proposed Claims (the extraction methods listed
in `CURRENT_EXTRACTION_METHODS`) of each Candidate's latest Evidence: names
and alternative names, county, stated settlements, OSM nearby places,
coordinates, address, websites, business email domain, tax id, certificate
number, structure type, and capacity.

Name normalisation folds diacritics (ş/ș and ţ/ț compare equal), removes type
words (`pensiunea`, `casa`, `vila`, `cabana`, `hotel`, `apartament`, Hungarian
`panzió`, `vendégház`, …) and stop words, and separates **unit numbers**
(`2`, `12a`, roman numerals) from the identifying core.

## Step 1 — candidate generation (blocking)

Pairs are compared only when they share a block:

- county + identical core name, or county + core token (tokens shared by more
  than 400 Candidates in a county are skipped as non-discriminative);
- website identity, business email domain, or tax id (identifiers shared by
  more than **50** Candidates — chains, property managers, platforms — are
  recorded as _broad identifiers_ and neither block nor count as evidence);
- county + street + house number;
- ~500 m spatial cells for objects with coordinates.

On the baseline data this compared **465,426 pairs** out of about 918 million
possible pairs among 42,861 Candidates.

## Step 2 — signals

Each compared pair receives explainable signals, stored with the suggestion:

| Signal                         | Meaning                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `geo.basis`                    | `same_site` (≤ 250 m), `settlement` (stated or nearby place agrees), `county_only`, `different_county`, `unknown`   |
| `nameSimilarity`               | Character-trigram Dice similarity of cores with equal unit numbers                                                  |
| `exactCoreName`                | Identical core name and unit numbers                                                                                |
| `weakName`                     | Core shared by > 3 Candidates in the county or > 10 nationally, equal to a place name, or shorter than 4 characters |
| `unitNumberConflict`           | Same or near-identical core with different unit numbers (`Vila 1` / `Vila 2`)                                       |
| `address`                      | `match`, `conflict` (same street, different number), `different_street`, `unknown`                                  |
| `structureTypes.compatibility` | Register type compatible with OSM `tourism` value (e.g. `pensiune_turistica` ↔ `guest_house`)                       |
| `typeWordConflict`             | Names carry incompatible type words (`Hotel X` vs `Apartament X`)                                                   |
| `sameCertificateNumber`        | Register pairs only                                                                                                 |
| `capacityDiffers`              | Both capacities known and different                                                                                 |
| shared identifiers             | `sharedTaxId`, `sharedWebsite` (own domain or platform page), `sharedEmailDomain`                                   |
| `contradictions`               | The list of contradicting signals that blocked a stronger decision                                                  |

## Step 3 — decisions

Register-to-register pairs (stated settlement must match exactly; sharing only
the commune is not enough):

| Rule                                      | Decision                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| same core + same certificate number       | `likely` same property                                   |
| same core + address match + same capacity | `likely` same property                                   |
| same core, no contradiction               | `possible` (multi-certificate property or sibling units) |
| near-identical name (≥ 0.85)              | `possible`                                               |

Cross-source and OSM-to-OSM pairs (geography must agree):

| Rule                                                                            | Decision                   |
| ------------------------------------------------------------------------------- | -------------------------- |
| exact core, not a weak name, no contradiction                                   | `likely` same property     |
| address match + name similarity ≥ 0.5, no contradiction                         | `likely`                   |
| same platform listing page, no contradiction                                    | `likely`                   |
| exact core with a caveat (weak name or a contradiction other than unit numbers) | `possible`                 |
| name similarity ≥ 0.6, no unit-number or house-number conflict                  | `possible`                 |
| otherwise, shared tax id                                                        | `likely` same **provider** |
| otherwise, shared own website, email domain, or listing page                    | `possible` same provider   |

Register-to-register pairs never receive same-provider suggestions: the
register already names the operator, and grouping by tax id is reported
instead (2,870 operator groups).

**Ambiguity rule:** if a Candidate would receive more than one `likely`
same-property counterpart from the other source (a complex with several
certificates, sibling units, or a generic name), all those suggestions are
downgraded to `possible` with the rule `downgraded_multiple_counterparts`.

`likely` means "no rule found a contradiction"; it is the tier the matcher
would propose for automatic acceptance in a future workflow and is the tier
measured separately in evaluation. `possible` always requires human review.

## Auditability and correction

- Suggestions are immutable rows keyed by (pair, relation, matcher version);
  re-running the same version is idempotent (verified: second run created 0).
- A new matcher version writes a new set; earlier sets remain inspectable.
- Generating suggestions writes an audit event
  (`duplicate_suggestions.generated`).
- Review decisions and merges are out of scope for this baseline: the schema
  stores `review_status = 'unreviewed'` only, enforced by a CHECK constraint.
  Accepting or rejecting a suggestion belongs to Curation and will add
  decision records rather than editing suggestions.

## How rules were developed

Thresholds and rules were set by inspecting examples from the **tuning
partition only** (`grp-eval-partition@1`, about 30 % of records by hashed
record identity). Rules added after inspection, with the pattern that
motivated them:

- unit-number separation — register pairs such as "… Apartments 2" / "… 5";
- exact-settlement requirement for register pairs — same commune, different
  village and street;
- weak-name conditions — cores equal to the place name, single generic words;
- removal of "address match with unrelated name" and "unnamed objects near
  each other" — both produced mostly unrelated pairs;
- free-mail and listing-platform lists, broad-identifier threshold — one
  property manager produced about 13,000 register pairs through a shared email
  domain before the change.

The evaluation partition was not inspected. Its accuracy is unmeasured until
independent review is completed (see the [protocol](./evaluation-protocol.md)).

## Known limitations

- The register has no coordinates, so register-to-OSM agreement relies on
  settlement names; properties far from their village's place node can be
  missed, and settlement names repeat across counties (the county is always
  required).
- Renamed properties without a shared address or listing are not found.
- OSM complexes are single objects, so a complex with several register
  certificates is downgraded to `possible`.
- Trigram similarity favours long names; very short names are treated as weak.
- No probabilistic calibration: scores rank suggestions but are not
  probabilities.
