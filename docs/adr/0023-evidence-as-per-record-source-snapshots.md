# Evidence as per-record source snapshots with checksum-referenced artifacts

Acquired data is stored as one immutable **Evidence** row per distinct content
of a source record (keyed by source, source record key, and content checksum)
in PostgreSQL, with fields withheld according to the source's retention
policy. Whole downloaded files are registered as **Source Artifacts** by
checksum, dataset version, URL, retrieval time, and reuse terms, but the files
themselves stay outside the database and outside the repository. How each run
interpreted each record (parsed or rejected, errors, campaign scope) is stored
per run, not on Evidence, so new parser or normalizer versions add Claims and
never rewrite Evidence.

## Why

- Artifacts are large (331 MB for OpenStreetMap Romania) and some carry
  unconfirmed reuse terms or personal data; storing them in PostgreSQL or a
  public repository would distribute restricted content and bloat the system
  of record. Per-record snapshots keep only what Claims need, in the
  authoritative store, with redaction applied at the record boundary.
- Content-level identity makes repeated imports idempotent even when a source
  regenerates byte-different files for the same data (observed for the
  official register).
- Per-run interpretation records make failures and rejections inspectable
  without mutating Evidence.

## Consequences

- Exact reproduction of a run requires the archived artifact, matched by
  checksum; the team must keep restricted artifacts in private storage.
- Redacted fields are unrecoverable from ELPA's database; the record checksum
  still covers the full original row, so changes in withheld fields are
  detected.
- A future object store for artifacts needs its own ADR (PostgreSQL remains
  the system of record).
