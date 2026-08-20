# ELPA Discovery and Recommendation

ELPA structures evidence about event providers and their offers so internal
operators can approve reliable data for later recommendation to users.

## Ambition and scope

ELPA is being built to become the primary interface for organising an event
end-to-end. The **Recommendation Product** serves both individual planners
(B2C) and business clients (B2B — agencies, corporate teams, associations,
public-sector organisers) from the same catalog. The catalog is intended to
cover the full supplier stack of an event: from the venue and **Operating
Location** down to the smallest supporting supplier (rentals, staffing,
transport, decor, entertainment, catering add-ons, long-tail specialists).

The strategic moat is a large, continuously refreshed database of
**Providers** and **Offers** built through focused **Research Campaigns**,
manual curation, and — as sources prove themselves — automated **Acquisition
Runs** at scale. Regardless of how a **Claim** is acquired, the
Recommendation Product only ever surfaces **Verified** and **Published**
data, so scale never bypasses trust.

## Initial market

The first launch market is **Romania**. Romanian is the primary user-facing
language, and initial **Research Campaigns**, category coverage, and source
selection target Romania. The domain model, i18n infrastructure, and
persistence design remain locale-generic so a second market can be opened
without domain refactoring; the decision to open one will be recorded as an
ADR.

## Language

**Data Studio**:
ELPA's internal product for researching, structuring, verifying, publishing,
and maintaining recommendation data.
_Avoid_: Admin Dashboard, back office

**Recommendation Product**:
The user-facing product that turns an event need into explainable
recommendations based on approved offers.
_Avoid_: MVP as a permanent product name

**Administrator**:
An internal team member with full Data Studio capabilities during the alpha.
_Avoid_: User, Operator during alpha

**User**:
A person who uses the Recommendation Product without requiring an account in
the initial release.
_Avoid_: Administrator, customer until a commercial relationship exists

**Event Brief**:
The structured description a **User** builds through the Recommendation
Product's stepper: event type, guest counts (total and overnight), date
window, region, vibe, must-haves, and budget. An Event Brief lives on the
User's session and is never an attribute of an **Offer**. The recommendation
engine and AI helper reason over `Event Brief × Offer` to rank
recommendations and to surface unmet needs (e.g., "outdoor event, off-grid
property — have you considered a backup generator?").
_Avoid_: Event (unqualified — the User's plan is the Event Brief; the
gathering itself has no domain representation), Search query, Filters

**Research Campaign**:
A bounded research effort defined by a geographic area, event need, category,
minimum criteria, and investigated sources.
_Avoid_: Scrape job, crawl

**Acquisition Run**:
One recorded attempt to import, fetch, extract, discover, or detect change from
a defined input and source.
_Avoid_: Scrape when the acquisition stage is more specific

**Candidate**:
A discovered possible provider, location, or offer that has not yet passed
verification.
_Avoid_: Provider, listing

**Claim**:
A source-attributed immutable observation about a candidate, provider,
location, or offer, including its value and observation time.
_Avoid_: Fact, canonical field

**Evidence**:
The source material that supports one or more claims.
_Avoid_: Truth

**Provider**:
A canonical economic actor that supplies one or more offers for events or
experiences.
_Avoid_: Candidate, listing, supplier

**Operating Location**:
A physical place from which a provider operates, distinct from an offer that a
user may select.
_Avoid_: Provider, venue

**Offer**:
A concrete service, product, package, rental, or bookable place that can be
evaluated for recommendation.
_Avoid_: Provider, listing

**Group Rental Property**:
The first **Category** targeted by the POC vertical slice — an **Offer** in
which a **User** rents a full property (no shared spaces with strangers, no
live-in staff) for a group stay, typically overnight, suitable for events
such as birthdays, baby showers, weekend getaways, or gatherings with
barbecue. Property type (`cabana`, `casa_de_vacanta`, `vila`, `complex`,
`cottage`) is an attribute of the Offer, not a separate Category. Public
Romanian label: _Cabane și case de închiriat_.
_Avoid_: Cabin, House, Cottage as separate Categories; Pensiune, Hotel,
short-term city Apartment (out of scope for this Category)

**Verification**:
A human decision about whether collected claims are sufficiently supported for
their intended use.
_Avoid_: Automatic validation

**Publication**:
The act of making approved data eligible for consumption by the recommendation
product.
_Avoid_: Discovery, approval

**Reverification**:
A later verification prompted by age, change, contradiction, or risk in
previously approved data.
_Avoid_: Refresh
