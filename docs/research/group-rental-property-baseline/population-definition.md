# Research population: Group Rental Property (rubric v1)

Status: **v1, accepted for the acquisition baseline experiment.** Version
identifier in code: `grp-population-screening@1`
(`apps/api/src/research/acquisition/population-screening.ts`). Any change to
the rules below requires a new version identifier; Claims produced by earlier
versions remain stored as history.

## Purpose

This document defines _what ELPA is trying to discover_ for the
**Group Rental Property** Category so that engineers, independent reviewers,
and the automated screening apply the same definition. It distinguishes:

- the **research population** — real-world properties ELPA wants to know
  about; and
- **automated screening** — a hint computed from source fields that orders
  review work but never establishes eligibility.

Only a reviewer with evidence (see [evaluation protocol](./evaluation-protocol.md))
can label a property `in_scope`. No source used in this baseline states whole-
property rental or event permission, so no Candidate is in scope by default.

## Definition

A property belongs to the research population when **all** of the following
hold:

1. **Location**: it is in Romania.
2. **Exclusive use**: a group can rent the whole property (or a whole,
   clearly bounded part such as a separate house in a complex) without
   sharing sleeping, kitchen, or living spaces with other guests during the
   stay.
3. **Group capacity**: it sleeps at least **6** persons (rubric v1 threshold;
   to be calibrated by review). Daytime-only venues are not in this Category.
4. **Stay-based**: it offers overnight stays, typically priced per night or
   per stay rather than per bed.
5. **Bookable as an Offer**: some Provider (owner or management firm) can be
   contacted to rent it. Aggregator platforms are Evidence sources, never
   Providers.

Event suitability (barbecue, private party, team-building) is **not** a
membership condition. It is a separate set of Claims (Tier 2
`parties_allowed`, `outdoor_grill`, `quiet_hours_*`, … in
[`data-studio-alpha.md`](../../product/data-studio-alpha.md)) whose absence is
**unknown**, never "no".

## Distinctions that the definition must survive

| Real-world situation                       | Population decision                                                                                                        | Catalog modelling                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Standalone cabin (_cabană_) rented whole   | In scope when capacity ≥ 6                                                                                                 | One Offer                                                                                        |
| Mountain hut (_cabană turistică_, staffed) | Out of scope when rented by bed or room; ambiguous until evidence shows whole rental                                       | —                                                                                                |
| Chalet complex with several cabins         | Each cabin rentable whole is in scope; the whole complex is in scope when rentable as one                                  | One Offer per independently bookable cabin plus one for the whole complex (glossary rule)        |
| Guesthouse (_pensiune_) rented by room     | Out of scope                                                                                                               | —                                                                                                |
| Guesthouse available for exclusive rental  | In scope **only with evidence** of exclusive rental (owner statement, "închiriere integrală", whole-property price)        | One Offer for the exclusive-rental arrangement (see flagged ambiguity below)                     |
| Holiday home (_casă de vacanță_)           | In scope when capacity ≥ 6                                                                                                 | One Offer                                                                                        |
| Commercial event venue without stays       | Out of scope for this Category (a future Venue Offer Category)                                                             | —                                                                                                |
| Hotel with group accommodation             | Out of scope: rooms are let individually even for groups                                                                   | —                                                                                                |
| Provider operating several Locations       | Each property is assessed separately; sharing an operator, tax id, website, or email domain never makes two properties one | One Provider, several Offers. _Operating Location is not used for this Category_ (glossary rule) |
| Several Offers at one Location             | Each independently bookable unit is assessed separately                                                                    | Several Offers with the same address and Provider                                                |
| City apartment, short-term let             | Out of scope (glossary); a rural apartment-classified whole house may be ambiguous                                         | —                                                                                                |

### The word _cabană_

_Cabană_ is not one accommodation type. In Romanian usage and in the sources
it names at least: a staffed mountain hut (_cabană turistică_ in the official
classification, `tourism=alpine_hut` in OSM), a privately owned holiday cabin
rented whole, a unit in a chalet complex, and a marketing name for a
guesthouse ("Pensiunea Cabana X"). The rubric therefore never infers scope
from the word alone; it is one weak signal (`house_like_name`).

## Evidence required for review decisions

| Question                     | Sufficient evidence                                                                                                                                       | Insufficient on its own                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Whole-property rental        | Owner or Provider page stating exclusive/whole rental; listing typed as an entire place; price per property per night; a booking flow for the whole house | Register classification; OSM `tourism=chalet`; a photo of a house; the word _cabană_ |
| Group capacity               | Stated number of guests or beds for the whole property; register `Număr locuri` for the certificate (capacity of the classified unit)                     | Number of rooms without beds                                                         |
| Event suitability            | Explicit house rules or Provider statement on parties/events, terrace/grill, music, quiet hours                                                           | A listing's silence; generic "ideal for groups" marketing                            |
| Same property across sources | Same address and house number, coordinates on the same building, the same listing page, or owner confirmation                                             | Similar names; the same village; the same operator, website, or tax id               |

## Conditions that remain unknown

The baseline sources cannot establish: whole-property rental, event
permission, pricing, current operation (a classified structure may be
inactive), seasonal availability, or the number of unregistered properties.
Reports label these as unknown rather than estimating them.

## Rubric v1 (automated screening)

Screening is an inferred Claim `offer.population_screening` with
`evidence.type = inferred`, `policyId = grp-population-screening@1`, and the
list of reasons that fired. Classes:

- `plausible` — consistent with whole-property group rental; needs evidence.
- `ambiguous` — the structure type is usually let by room or unit, or is a
  multi-unit complex; exclusive rental is possible but unknown.
- `out_of_scope` — the type or context excludes the population.
- `insufficient_data` — no structure type.

Rules, evaluated in order:

1. **Excluded types** → `out_of_scope`: register `hotel`, `hotel_apartament`,
   `motel`, `hostel`, `camping`, `spatii_de_campare`, `popas_turistic`,
   `ponton_plutitor`, `nava_fluviala`, `nava_maritima`; OSM `hotel`, `motel`,
   `hostel`, `alpine_hut`, and `camp_site` without `cabins=yes`.
2. **Apartment in a block** (`BL.` or `AP.` in the register address) →
   `out_of_scope`.
3. **Known capacity below 6** → `out_of_scope`.
4. **Urban apartments**, and **urban rooms for rent without a house-like
   name** → `out_of_scope`.
5. **Multi-unit complexes** (register `casute_tip_camping`, `bungalouri`,
   `sat_de_vacanta`; OSM `camp_site` with cabins) → `ambiguous`.
6. **Non-urban whole-dwelling type** (register `vila_turistica`,
   `cabana_turistica`; OSM `chalet`) **or house-like name** (_casa, căsuța,
   cabana, vila, chalet, cottage, conac, house, lodge, kulcsosház_), with
   capacity ≤ 40 or unknown → `plausible`.
7. Remaining rooms/apartments/guesthouse/whole-dwelling types → `ambiguous`.

Urbanity comes from the register's settlement kind (sat/comună rural;
municipiu/oraș/sector urban; component localities unknown) or, for OSM, from
the nearest settlement node within its type radius (objects with none are
treated as rural).

### Known weaknesses (to be measured, not assumed)

- House-like words appear in names of non-rental places (an OSM
  `guest_house` named "Centru de Bătrâni Casa …" — an elderly-care home — is
  screened `plausible`).
- Register capacity is per classified unit; a complex with several
  certificates may sleep far more than any one row says.
- The capacity thresholds (6 and 40) are product hypotheses.

## Flagged terminology conflicts

These are flagged for a domain decision rather than silently resolved:

1. `UBIQUITOUS_LANGUAGE.md` lists _Pensiune_ as out of scope for this Category
   and requires "no live-in staff". Many Romanian guesthouses are let
   exclusively to one group with the owner living next door. Rubric v1 keeps
   guesthouses `ambiguous` (not `out_of_scope`) so that review can measure
   how often exclusive rental occurs; the glossary definition is unchanged
   until that evidence exists.
2. "Hotel with group accommodation" is out of scope here; if event venues
   with rooms are wanted later they need their own Category.
