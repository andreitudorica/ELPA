# Image rights and processing eligibility

This experiment uses only the three direct Commons File references already
present in imported OSM Evidence. The source URL association is unverified;
OSM's database licence does not establish rights to linked photographs.

For each file, the Commons Imageinfo response supplied a **CC BY-SA 4.0** licence
URL, credit, upload timestamp, source SHA-1, original URL, size and dimensions.
The exact response is retained privately. Eligibility requires that explicit
licence, nonempty credit, HTTPS Commons metadata and original Wikimedia asset
hosts, permitted format/size, matching source fingerprint and successful decode.
Missing, changed or incompatible metadata rejects acquisition without replacement.

The [CC BY-SA 4.0 licence](https://creativecommons.org/licenses/by-sa/4.0/)
allows commercial copying and adaptation subject to its conditions, including
attribution and applicable share-alike requirements. It does not supply all
privacy, publicity or other rights. This is a bounded operational assessment,
not a blanket commercial rights clearance or a legal opinion about AI training.

| Use                      | Experiment eligibility                       | Recorded basis or limitation                                                                              |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Access metadata/original | Yes, bounded public API and image requests   | Identified user agent; no authentication or technical restriction bypass                                  |
| Download                 | Conditional yes for the three eligible files | Per-file explicit licence; source SHA-1 and size checked                                                  |
| Retain original          | Conditional yes, privately                   | Credit/licence/source version retained with Evidence; no originals in Git                                 |
| Local technical analysis | Conditional yes                              | Decode, orientation, dimensions, SHA-256, dHash and private preview                                       |
| External vision service  | Pending separate authorization               | Copyright conditions, provider terms, privacy minimization, approved model and budget must all be checked |
| Redistribute or publish  | Not authorized by this experiment            | Licence may allow conditional distribution; this task creates no public media surface                     |

The original image, metadata and caption stay private. Preview generation removes
embedded metadata but **does not detect or redact faces or licence plates**.
No original or preview is automatically sent to a vision provider. The capture
protocol requires a human privacy attestation tied to the exact preview hash.
An operator must use only the cleared preview, or produce and version a minimized
derivative and extend the protocol before external processing. An attestation
string is an auditable record, not proof that a person actually performed review.

An engineering inspection opened only the development preview. It is not an
independent annotation or a formal vision-model benchmark. The two holdout
images were not used for semantic tuning. All three remain externally uncleared.

Primary references:

- [Commons Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo).
- [Wikimedia user-agent policy](https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy).
- [The development file's licence and history](https://commons.wikimedia.org/wiki/File:Pensiune_Artarul_in_Poiana_Marului.jpg).

The key-only manifest identifies the other files and source versions. Inspect
each original licence response and file page before a new use. All photographed
facilities may have changed since their recorded 2018 capture dates.
