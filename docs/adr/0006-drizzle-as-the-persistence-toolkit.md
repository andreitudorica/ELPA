# Drizzle as the persistence toolkit

ELPA will use Drizzle ORM for PostgreSQL schema definitions, migrations, and
type-safe persistence access because its SQL-oriented model supports complex
filters and bulk workflows without hiding PostgreSQL capabilities. Domain logic
will depend on module-owned persistence boundaries rather than Drizzle itself,
and reviewed SQL remains an accepted escape hatch when it is clearer or more
capable than the ORM query API.
