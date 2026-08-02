# Data Studio alpha

## Objective

Validate the manual process required to build a small, trustworthy, locally
dense catalog before automating discovery or extraction at scale.

The alpha succeeds when the team can run one complete Research Campaign from
source discovery through published, explainable data and can identify where
manual effort, uncertainty, and data gaps actually occur.

## Initial users and access

The alpha has one role: **Administrator**. Authentication is simulated only in
local development or an infrastructure-protected private alpha environment.
Every sensitive action still receives an actor and timestamp so later OIDC
integration does not require redesigning the domain workflow.

## In scope

1. Create and track a Research Campaign.
2. Add a Candidate manually or import a URL.
3. Record Evidence and Claims without writing directly to canonical records.
4. Review extracted or manually entered Claims.
5. Search for possible duplicates and resolve a Candidate to a canonical
   Provider or Offer.
6. Create and maintain Providers, Operating Locations, Offers, and Categories.
7. Verify Claims and select canonical values with rationale.
8. Publish approved projections for API consumption.
9. Flag stale or contradictory data for reverification.
10. Inspect actor-attributed audit history.
11. Measure coverage and data quality for the chosen campaign.

## Explicitly out of scope

- Exhaustive national coverage.
- Autonomous publication by AI or scrapers.
- Live availability guarantees or booking transactions.
- Provider self-service onboarding.
- Fine-grained Data Studio roles beyond Administrator.
- Production OIDC authentication during the protected alpha.
- A general-purpose workflow builder.
- A permanent scraping platform before experiments justify it.

## Suggested first vertical slice

Use one category and one geographic campaign. Implement the complete path:

```text
Research Campaign
  -> manual Candidate
  -> Evidence and Claims
  -> duplicate review
  -> canonical Provider and Offer
  -> Verification Decision
  -> Publication
  -> public read through the generated API client
```

This tracer bullet proves the API, database model, OpenAPI generation, both
trust boundaries, and the curation-to-publication separation before breadth is
added.

## Alpha outcomes

The team should leave the alpha with evidence for:

- the fields common to all Offers versus category-specific attributes;
- the minimum publishable Claim set;
- review time per Provider and Offer;
- duplicate frequency and useful matching signals;
- field-specific freshness expectations;
- coverage gaps for the initial use case and geography;
- which acquisition steps merit automation.
