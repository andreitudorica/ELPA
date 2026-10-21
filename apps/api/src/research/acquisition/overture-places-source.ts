import { z } from 'zod';

import { screenGroupRentalProperty } from './population-screening';
import { countyCodeFromName, isCountyCode } from './romania-geography';
import {
  ArtifactFormatError,
  type JsonObject,
  type JsonValue,
  type SourceArtifactReading,
  type SourceRecord,
} from './source-record';
import { cleanDisplayText, normalizePropertyName } from './text-normalization';
import { normalizeWebsite } from './web-identity';

export const OVERTURE_SOURCE_KEY = 'overture_places';
export const OVERTURE_PARSER_VERSION = 'overture-places-snapshot@2';
export const OVERTURE_NORMALIZER_VERSION = 'overture-places-normalizer@2';
export const OVERTURE_SCREENING_VERSION = 'overture-population-screening@1';
export const OVERTURE_GEOMETRY_VERSION = 'overture-bbox-point@1';

// This experiment deliberately supports only providers with the same licence.
// A new provider or explicit conflicting licence requires a separate review.
const CDLA_PROVIDERS = new Set(['meta', 'Microsoft', 'Overture']);
const sourceSchema = z.object({ dataset: z.string(), license: z.string().nullish() });
const addressSchema = z.object({
  country: z.string().nullish(),
  region: z.string().nullish(),
  locality: z.string().nullish(),
  freeform: z.string().nullish(),
});
export const OvertureRecordSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  names: z.object({ primary: z.string().nullable() }).nullable(),
  bbox: z.object({
    xmin: z.number().min(-180).max(180),
    xmax: z.number().min(-180).max(180),
    ymin: z.number().min(-90).max(90),
    ymax: z.number().min(-90).max(90),
  }),
  addresses: z.array(addressSchema).nullable(),
  taxonomy: z.object({
    primary: z.string(),
    hierarchy: z.array(z.string()),
    alternates: z.array(z.string()).nullish(),
  }),
  sources: z.array(sourceSchema).min(1),
  websites: z.array(z.string()).nullable(),
  socials: z.array(z.string()).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  operating_status: z.string().nullable(),
});
export type OvertureRecord = z.infer<typeof OvertureRecordSchema>;

const snapshotSchema = z.object({
  snapshotVersion: z.literal('elpa-overture-sample@1'),
  release: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/),
  retrievedAt: z.iso.datetime(),
  sampling: z.record(z.string(), z.json()),
  records: z.array(z.record(z.string(), z.json())).min(1).max(144),
});

export function overtureCounty(region: string | null | undefined) {
  if (region === null || region === undefined) return null;
  const code = region.startsWith('RO-') ? region : `RO-${region.toUpperCase()}`;
  return isCountyCode(code) ? code : countyCodeFromName(region);
}

export function hasPermittedOvertureSources(row: Pick<OvertureRecord, 'sources'>): boolean {
  return row.sources.every(
    (source) =>
      CDLA_PROVIDERS.has(source.dataset) &&
      (source.license == null || source.license === 'CDLA-Permissive-2.0'),
  );
}

/** Deterministic normalisation of a bounded, pinned export, never a web crawler. */
export function readOverturePlacesArtifact(input: unknown): SourceArtifactReading {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw new ArtifactFormatError('overture.invalid_snapshot', parsed.error.message);
  }
  const snapshot = parsed.data;
  const ids = new Set<string>();
  const records = snapshot.records.map((raw, index) => {
    const sourceMetadata = z.array(sourceSchema).min(1).safeParse(raw.sources);
    if (!sourceMetadata.success || !hasPermittedOvertureSources({ sources: sourceMetadata.data })) {
      throw new ArtifactFormatError(
        'overture.unapproved_licence',
        'Provider or explicit licence has not been approved; no records may be retained',
      );
    }
    const row = OvertureRecordSchema.safeParse(raw);
    const key = typeof raw.id === 'string' ? raw.id : `invalid-row/${String(index + 1)}`;
    if (ids.has(key)) {
      throw new ArtifactFormatError('overture.duplicate_id', `Repeated source identity ${key}`);
    }
    ids.add(key);
    const record: SourceRecord = {
      sourceRecordKey: key,
      sourceRecordUrl: `https://explore.overturemaps.org/?gers=${encodeURIComponent(key)}`,
      position: index + 1,
      // File/release context belongs to the artifact and run. Including it
      // here would invent changed Evidence for unchanged native content.
      rawPayload: Object.fromEntries(Object.entries(raw).filter(([field]) => field !== 'filename')),
      redactedFields: ['emails', 'phones'],
      status: 'rejected',
      errors: [],
      claims: [],
      summary: null,
      scopeSettlements: [],
    };
    const reject = (code: string, message: string) => {
      record.errors.push({ code, message });
      return record;
    };
    if (!row.success) return reject('invalid_record', row.error.message);
    const value = row.data;
    if (!value.taxonomy.hierarchy.includes('lodging'))
      return reject('not_lodging', 'Record is not in the lodging taxonomy hierarchy');
    const address = value.addresses?.find((entry) => entry.country === 'RO');
    const county = overtureCounty(address?.region);
    if (address === undefined || county === null)
      return reject('unresolved_county', 'No Romanian address with a recognised county');
    const box = value.bbox;
    if (
      box.xmin > box.xmax ||
      box.ymin > box.ymax ||
      box.xmin < 20.2 ||
      box.xmax > 29.8 ||
      box.ymin < 43.5 ||
      box.ymax > 48.3 ||
      box.xmax - box.xmin > 0.001 ||
      box.ymax - box.ymin > 0.001
    )
      return reject('invalid_point_bbox', 'Expected a point bounding box in the Romanian frame');

    const name = cleanDisplayText(value.names?.primary);
    const locality = cleanDisplayText(address.locality);
    const category = value.taxonomy.primary;
    // These are screening inputs only, not assertions of rental mode or
    // equivalence between Overture and register classifications.
    const type = /hotel|motel|hostel|resort/.test(category)
      ? 'hotel'
      : /cabin|chalet|cottage|vacation_home/.test(category)
        ? 'cabana_turistica'
        : 'pensiune_turistica';
    const screening = screenGroupRentalProperty({
      structureType: type,
      sleepsPersons: null,
      urbanity: 'unknown',
      nameTypeWords: normalizePropertyName(name ?? '').typeWords,
      apartmentBuilding: false,
    });
    if (value.operating_status === 'permanently_closed') {
      screening.screeningClass = 'out_of_scope';
    }
    const explicit = (target: string, claimValue: JsonValue, fields: string[]) => {
      record.claims.push({
        target,
        value: claimValue,
        confidence: 1,
        locator: { type: 'structured_field', fields },
      });
    };
    if (name !== null) explicit('offer.name', name, ['names.primary']);
    explicit(
      'offer.overture_categories',
      { primary: category, hierarchy: value.taxonomy.hierarchy },
      ['taxonomy'],
    );
    explicit(
      'offer.primary_locality',
      {
        countyCode: county,
        settlementName: locality,
        urbanity: 'unknown',
        settlementSource: 'source_address',
      },
      ['addresses'],
    );
    record.claims.push({
      target: 'offer.coordinates',
      value: { lon: (box.xmin + box.xmax) / 2, lat: (box.ymin + box.ymax) / 2 },
      confidence: 0.95,
      extractionMethod: OVERTURE_GEOMETRY_VERSION,
      locator: {
        type: 'inferred',
        policyId: OVERTURE_GEOMETRY_VERSION,
        rationale: 'Midpoint of the source point bounding box; not a surveyed property boundary.',
        inputs: { bbox: { ...box } },
      },
    });
    if (address.freeform != null)
      explicit('offer.address', { raw: address.freeform }, ['addresses']);
    const websites = [...(value.websites ?? []), ...(value.socials ?? [])]
      .map(normalizeWebsite)
      .filter((site) => site !== null);
    if (websites.length > 0)
      explicit(
        'offer.website',
        websites.map((site) => ({ ...site })),
        ['websites', 'socials'],
      );
    record.claims.push({
      target: 'offer.population_screening',
      value: {
        screeningClass: screening.screeningClass,
        reasons: screening.reasons,
        categoryMapping: type,
        operatingStatus: value.operating_status,
      },
      confidence: 0.4,
      extractionMethod: OVERTURE_SCREENING_VERSION,
      locator: {
        type: 'inferred',
        policyId: OVERTURE_SCREENING_VERSION,
        rationale:
          'Category mapping and rubric-v1 screening order review only; rental mode and event permission remain unknown.',
        inputs: { category, operatingStatus: value.operating_status },
      },
    });
    record.status = 'parsed';
    record.summary = {
      displayName: name ?? key,
      countyCode: county,
      settlementName: locality,
      screeningClass: screening.screeningClass,
    };
    record.scopeSettlements = locality === null ? [] : [locality];
    return record;
  });
  const metadata: JsonObject = {
    release: snapshot.release,
    sampling: snapshot.sampling,
    sourceFiles: [
      ...new Set(
        snapshot.records.flatMap((row) => (typeof row.filename === 'string' ? [row.filename] : [])),
      ),
    ].sort(),
    contactFieldsWithheld: ['emails', 'phones'],
    observationMeaning: 'Retrieval of a published release, not proof that the property is current.',
  };
  return {
    sourceKey: OVERTURE_SOURCE_KEY,
    datasetVersion: snapshot.release,
    observedAt: new Date(snapshot.retrievedAt),
    parserVersion: OVERTURE_PARSER_VERSION,
    normalizerVersion: OVERTURE_NORMALIZER_VERSION,
    metadata,
    records,
    excluded: {},
  };
}
