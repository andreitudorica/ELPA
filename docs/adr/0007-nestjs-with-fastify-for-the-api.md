# NestJS with Fastify for the API

The shared API will use NestJS with the Fastify adapter. NestJS supplies
consistent module boundaries, dependency injection, validation, OpenAPI
integration, and integration points for background work, while Fastify provides
the HTTP runtime; controllers remain thin, and domain logic, PostgreSQL queries,
and long-running processing stay in module-owned services and persistence
boundaries.
