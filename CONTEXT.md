# ELPA Discovery and Recommendation

ELPA structures evidence about event providers and their offers so internal
operators can approve reliable data for later recommendation to users.

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
