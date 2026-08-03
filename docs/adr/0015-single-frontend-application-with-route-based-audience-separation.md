# Single frontend application with route-based audience separation

ELPA will ship one client application, `apps/web`, that serves both the
anonymous Recommendation Product and the internal Data Studio. Route families
separate the audiences: `/*` for anonymous public routes and `/studio/*` for
Administrator-guarded routes, implemented as two pathless layouts with two
`beforeLoad` policies. Trust-boundary enforcement remains an API responsibility
per ADR 0008 and ADR 0009; the frontend separation is UX, not authorization.
Information disclosure of admin route metadata (URLs, titles, search schemas)
to anonymous bundles is accepted; TanStack Router automatic code-splitting
keeps admin route components and API calls out of anonymous downloads. The
Recommendation Product is a self-contained anonymous tool with no SSR, SEO, or
crawlability requirement; if a future product surface requires SSR, SEO, or a
materially different UX profile, splitting into a second application must be
revisited through a new ADR. The projection separation between published and
canonical data is encoded through disjoint OpenAPI DTOs and TypeScript types
(`PublishedOffer` versus `Offer`, etc.) and enforced by an ESLint
`no-restricted-imports` boundary that prevents admin API namespaces from being
imported inside `recommendation/` or under the `_public` layout. The monorepo
therefore contains two applications, `apps/api` and `apps/web`; ADR 0002's
prohibition on cross-application imports and its monorepo-with-shared-packages
posture remain unchanged for the two applications that exist.
