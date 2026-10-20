import { createHash } from 'node:crypto';

import type { CountyCode } from './romania-geography';

/**
 * Contract between source adapters and the acquisition workflow. Adapters are
 * pure: given a versioned artifact they return immutable source records,
 * proposed Claims, and validation errors. They never touch persistence, never
 * decide that two records are the same property, and never produce canonical
 * or published values (ADR 0013).
 */

export const SOURCE_KEYS = ['situr_accommodation_register', 'osm_geofabrik_romania'] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

/** Where in the Evidence a Claim value comes from (see data-acquisition-experiments.md). */
export type EvidenceLocator =
  | { type: 'structured_field'; fields: string[] }
  | { type: 'inferred'; policyId: string; rationale: string; inputs: JsonObject };

export const SCREENING_CLASSES = [
  'plausible',
  'ambiguous',
  'out_of_scope',
  'insufficient_data',
] as const;
export type ScreeningClass = (typeof SCREENING_CLASSES)[number];

export interface ProposedClaim {
  target: string;
  value: JsonValue;
  locator: EvidenceLocator;
  /** Extractor confidence that the value reflects the source; never truth. */
  confidence: number;
  /** Versioned extraction method; defaults to the adapter's normalizer version. */
  extractionMethod?: string;
}

export interface RecordError {
  code: string;
  message: string;
  field?: string;
}

export interface SourceRecordSummary {
  displayName: string;
  countyCode: CountyCode | null;
  settlementName: string | null;
  screeningClass: ScreeningClass;
}

export interface SourceRecord {
  /** Stable identifier of the record within its source. */
  sourceRecordKey: string;
  /** Public URL of the original record, when the source has one. */
  sourceRecordUrl: string | null;
  /** 1-based position in the artifact; not part of the record's identity. */
  position: number;
  /** Minimally transformed source content, before retention-policy redaction. */
  rawPayload: JsonObject;
  /** Top-level payload fields withheld from storage by the retention policy. */
  redactedFields: string[];
  status: 'parsed' | 'rejected';
  errors: RecordError[];
  claims: ProposedClaim[];
  summary: SourceRecordSummary | null;
  /** Settlement names used to apply a Research Campaign's locality scope. */
  scopeSettlements: string[];
}

export interface SourceArtifactReading {
  sourceKey: SourceKey;
  /** Version stated by the artifact itself (register date, OSM replication time). */
  datasetVersion: string;
  /** Time the dataset version refers to; used as the Claims' observation time. */
  observedAt: Date;
  parserVersion: string;
  normalizerVersion: string;
  metadata: JsonObject;
  records: SourceRecord[];
  /** Source objects deliberately not imported, counted by reason. */
  excluded: Record<string, number>;
}

export class ArtifactFormatError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** JSON with recursively sorted keys, so checksums do not depend on key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function storedPayload(record: SourceRecord): JsonObject {
  if (record.redactedFields.length === 0) return record.rawPayload;
  const redacted = new Set(record.redactedFields);
  return Object.fromEntries(
    Object.entries(record.rawPayload).filter(([field]) => !redacted.has(field)),
  );
}
