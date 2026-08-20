# Ubiquitous Language

This glossary combines the product context document with decisions confirmed
during the domain interview. It will evolve as remaining ambiguities are
resolved.

## Research and curation

| Term                  | Definition                                                                                                                | Aliases to avoid                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Research Campaign** | A bounded research effort defined by a geographic area, event need, category, minimum criteria, and investigated sources. | Scrape job, crawl                                  |
| **Acquisition Run**   | One recorded attempt to import, fetch, extract, discover, or detect change from a defined input and source.               | Scrape when the acquisition stage is more specific |
| **Candidate**         | A discovered possible provider, location, or offer that has not yet passed verification.                                  | Provider, listing                                  |
| **Claim**             | A source-attributed immutable observation that preserves its value and observation time.                                  | Fact, canonical field                              |
| **Evidence**          | The source material that supports one or more **Claims**.                                                                 | Truth                                              |
| **Verification**      | A human decision that claims are sufficiently supported for their intended use.                                           | Automatic validation                               |
| **Publication**       | Making approved data eligible for consumption by the recommendation product.                                              | Discovery, approval                                |
| **Reverification**    | A later **Verification** prompted by age, change, contradiction, or risk.                                                 | Refresh                                            |

## Catalog

| Term                   | Definition                                                                                                | Aliases to avoid                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Provider**           | A canonical economic actor that supplies one or more **Offers** for events or experiences.                | Supplier, vendor, candidate, listing |
| **Operating Location** | A physical place from which a **Provider** operates.                                                      | Provider, venue                      |
| **Offer**              | A concrete service, product, package, rental, or bookable place that can be evaluated for recommendation. | Provider, listing                    |
| **Category**           | A controlled classification used to group comparable **Offers**.                                          | Tag, provider type                   |

## Products and actors

| Term                       | Definition                                                                                                                    | Aliases to avoid                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Data Studio**            | ELPA's internal product for researching, structuring, verifying, publishing, and maintaining recommendation data.             | Admin Dashboard, back office                                   |
| **Recommendation Product** | The user-facing product that turns an event need into explainable recommendations based on approved offers.                   | ELPA MVP as a permanent name                                   |
| **Administrator**          | An internal team member with full Data Studio capabilities during the alpha.                                                  | User, Operator during alpha                                    |
| **User**                   | A person seeking providers and offers through the Recommendation Product without requiring an account in the initial release. | Administrator, customer until a commercial relationship exists |

## Relationships

- A **Research Campaign** discovers zero or more **Candidates**.
- An **Acquisition Run** may produce zero or more **Candidates**, **Evidence**
  records, and proposed **Claims**.
- A **Candidate** accumulates one or more **Claims** supported by **Evidence**.
- Multiple **Candidates** may resolve to one canonical **Provider** or **Offer**.
- A **Provider** has one or more **Offers** and zero or more **Operating Locations**.
- An **Offer** belongs to one **Provider** and may belong to one or more **Categories**.
- Only data accepted through **Verification** becomes eligible for
  **Publication**.
- The **Recommendation Product** consumes published data; it does not consume
  raw **Candidates** or unverified **Claims**.
- An **Administrator** uses simulated identity during the **Data Studio** alpha;
  real authentication is deferred until after alpha.
- A **User** may use the initial **Recommendation Product** anonymously.

## Example dialogue

> **Developer:** "I found the same cabin on Google Maps and Booking. Do we have
> two **Providers**?"
>
> **Domain expert:** "No. We have two **Candidates** and several **Claims** that
> may resolve to the same **Provider** and **Offer**."
>
> **Developer:** "Can the **Recommendation Product** use the extracted price
> immediately?"
>
> **Domain expert:** "No. The price remains a **Claim** until **Verification** and
> becomes eligible only after **Publication**."

## Flagged ambiguities

- **Data Studio** is the confirmed canonical term for the internal product;
  “Admin Dashboard” may describe an administrative surface within it, but not
  the complete product.
- The source document uses “Provider” for a company, sole trader, location, or
  economic operator. The recommendation is to reserve **Provider** for the
  economic actor and keep **Operating Location** and **Offer** distinct.
- The source material uses the same word for an operating site and a place
  offered for an event. Use **Operating Location** for the former and **Venue
  Offer** (a subtype of **Offer**) for the latter.
- “Approved” may describe an entity, an offer, or an individual claim. The exact
  granularity of **Verification** and **Publication** remains unresolved.
- **Operator** is reserved for a possible future restricted curation role. The
  alpha has only the full-access **Administrator** role.
- “MVP” describes a delivery stage rather than a stable product responsibility.
  The recommendation is **Recommendation Product** in the domain language and
  a separate application name once branding is decided.
