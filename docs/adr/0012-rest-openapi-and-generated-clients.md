# REST, OpenAPI, and generated clients

Revised by ADR 0015: with a single client application, the generated
TypeScript client lives inside the client (`apps/web/src/lib/apiClient/`)
rather than as a shared `packages/api-client`. Contract-first discipline and
OpenAPI as the contract authority are unchanged; extraction into a shared
package is deferred until a second client application exists.

The shared API will expose REST/JSON contracts described by an OpenAPI
document, and the client application will consume a generated TypeScript
client. OpenAPI generation and client verification must accompany contract
changes; the client may not import backend implementation DTOs or maintain
parallel handwritten request types, keeping the contract inspectable and
available to future non-TypeScript consumers. The API contract exposes
distinct DTOs per projection (for example `PublishedOffer` and `Offer`) so
that the published-versus-canonical boundary from ADR 0013 is preserved in
the generated types.
