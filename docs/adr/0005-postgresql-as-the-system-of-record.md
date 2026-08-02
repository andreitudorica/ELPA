# PostgreSQL as the system of record

ELPA will use PostgreSQL as its authoritative operational database because the
curation and recommendation domains require relational integrity, complex
filtering, transactions, aggregation, and efficient bulk processing. Native
capabilities such as JSONB, full-text search, trigram indexes, and PostGIS may be
enabled when justified; secondary search or vector systems require measured
need and must remain derived from PostgreSQL rather than becoming competing
sources of truth.
