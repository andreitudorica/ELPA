# Database development workflow

## Tooling

The API workspace will install `drizzle-orm` and its selected PostgreSQL driver
as runtime dependencies. `drizzle-kit` will be a pinned development dependency,
so contributors and agents receive the migration CLI and Drizzle Studio through
the normal repository installation; no global installation is required.

The root workspace will expose stable scripts that delegate to the owning
database package or API application:

```text
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:studio
```

Exact script implementations will be added with the initial workspace scaffold.
The names above are the intended developer contract.

## Drizzle Studio

`pnpm db:studio` will run `drizzle-kit studio` using the repository's Drizzle
configuration. Drizzle Studio is recommended for inspecting and editing local
development data during schema and workflow development.

Drizzle Studio is development tooling, not part of Data Studio and not a
production administration surface. Do not expose its server publicly or point
it at production by default. See the official
[Drizzle Studio documentation](https://orm.drizzle.team/docs/drizzle-kit-studio)
for current behavior and supported options.

## Persistence rules

- PostgreSQL remains the authoritative system of record.
- Schema changes are represented by reviewed migrations committed to the
  repository.
- Application startup must not perform unreviewed schema mutation.
- Bulk operations and complex filters may use reviewed SQL when this is clearer
  than forcing them through the ORM query API.
- Credentials belong in ignored local environment files or an approved secret
  manager, never in Drizzle configuration committed to the repository.
