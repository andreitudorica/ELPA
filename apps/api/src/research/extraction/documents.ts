import { z } from 'zod';

import { canonicalJson, sha256Hex, SOURCE_KEYS } from '../acquisition/source-record';
import type { JsonObject } from '../acquisition/source-record';

export const PROJECTION_VERSION = 'grp-primary-fields@1';
export const fieldSchema = z
  .object({
    path: z.array(z.string()).min(1),
    text: z.string(),
    section: z.enum(['description', 'structured']),
  })
  .strict();
export const documentSchema = z
  .object({
    id: z.string(),
    candidateId: z.uuid(),
    evidenceId: z.uuid(),
    sourceKey: z.enum(SOURCE_KEYS),
    sourceRecordKey: z.string(),
    evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceVersion: z.string().min(1),
    artifactId: z.uuid(),
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
    observedAt: z.iso.datetime(),
    projectionVersion: z.literal(PROJECTION_VERSION),
    fields: z.array(fieldSchema),
    excludedFields: z.array(z.object({ path: z.array(z.string()), reason: z.string() }).strict()),
    textSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type PrimaryDocument = z.infer<typeof documentSchema>;
export type TextField = z.infer<typeof fieldSchema>;

const OSM_FIELDS = [
  'description',
  'description:ro',
  'description:en',
  'description:hu',
  'beds',
  'capacity:beds',
  'bedrooms',
  'bathrooms',
  'rooms',
  'capacity',
  'swimming_pool',
  'sauna',
  'hot_tub',
  'sport',
  'barbecue',
  'garden',
] as const;
const REGISTER_FIELDS = ['Număr locuri', 'Număr spații', 'Tip unitate'] as const;
/** Text that may carry an email address, URL or phone number never leaves Research. */
export const CONTACT_PATTERN = /@|https?:\/\/|www\.|(?:\+?\d[\s().-]*){9,}/i;

function object(value: unknown): Record<string, unknown> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** Exports only original allowlisted fields. Excluded contact-bearing fields stay excluded. */
export function projectFields(sourceKey: string, payload: JsonObject) {
  const fields: TextField[] = [];
  const excludedFields: PrimaryDocument['excludedFields'] = [];
  const entries =
    sourceKey === 'osm_geofabrik_romania'
      ? OSM_FIELDS.map((key) => ({ path: ['tags', key], value: object(payload.tags)[key] }))
      : sourceKey === 'situr_accommodation_register'
        ? REGISTER_FIELDS.map((key) => ({ path: [key], value: payload[key] }))
        : [];
  for (const { path, value } of entries) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value);
    if (text.trim() === '') continue;
    if (CONTACT_PATTERN.test(text)) {
      excludedFields.push({ path, reason: 'possible_contact_or_url' });
      continue;
    }
    fields.push({
      path,
      text,
      section: path.at(-1)?.startsWith('description') === true ? 'description' : 'structured',
    });
  }
  return { fields, excludedFields, textSha256: sha256Hex(canonicalJson(fields)) };
}

export function verifyDocument(document: PrimaryDocument): boolean {
  return (
    document.textSha256 === sha256Hex(canonicalJson(document.fields)) &&
    document.id ===
      sha256Hex(
        `${document.sourceKey}:${document.sourceRecordKey}:${document.evidenceSha256}:${document.textSha256}`,
      )
  );
}

export function documentFromEvidence(input: {
  candidateId: string;
  evidenceId: string;
  sourceKey: string;
  sourceRecordKey: string;
  contentSha256: string;
  sourceVersion: string | null;
  artifactId: string;
  artifactSha256: string;
  observedAt: Date;
  payload: JsonObject;
}): PrimaryDocument {
  const projected = projectFields(input.sourceKey, input.payload);
  return documentSchema.parse({
    id: sha256Hex(
      `${input.sourceKey}:${input.sourceRecordKey}:${input.contentSha256}:${projected.textSha256}`,
    ),
    candidateId: input.candidateId,
    evidenceId: input.evidenceId,
    sourceKey: input.sourceKey,
    sourceRecordKey: input.sourceRecordKey,
    evidenceSha256: input.contentSha256,
    sourceVersion: input.sourceVersion,
    artifactId: input.artifactId,
    artifactSha256: input.artifactSha256,
    observedAt: input.observedAt.toISOString(),
    projectionVersion: PROJECTION_VERSION,
    ...projected,
  });
}
