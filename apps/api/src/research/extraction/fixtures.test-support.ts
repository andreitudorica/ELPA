import { canonicalJson, sha256Hex } from '../acquisition/source-record';
import type { JsonObject } from '../acquisition/source-record';
import { documentFromEvidence } from './documents';

/** Synthetic only: never real source content or personal data. */
export function syntheticDocument(
  description = '',
  payload?: JsonObject,
  sourceKey = 'osm_geofabrik_romania',
  key = 'node/synthetic',
) {
  const raw = payload ?? { tags: { description } };
  return documentFromEvidence({
    candidateId: '01900000-0000-7000-8000-000000000001',
    evidenceId: '01900000-0000-7000-8000-000000000002',
    artifactId: '01900000-0000-7000-8000-000000000003',
    sourceKey,
    sourceRecordKey: key,
    contentSha256: sha256Hex(canonicalJson(raw)),
    sourceVersion: 'synthetic-v1',
    artifactSha256: 'a'.repeat(64),
    observedAt: new Date('2026-01-01T00:00:00Z'),
    payload: raw,
  });
}
