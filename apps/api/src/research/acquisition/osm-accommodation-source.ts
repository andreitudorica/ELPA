import {
  buildCountyPolygons,
  type CountyBoundaryInput,
  isPlaceType,
  locateCounty,
  type LonLat,
  type NearbyPlace,
  type Place,
  PlaceGazetteer,
  placeKeys,
  urbanityFromNearby,
} from './osm-geography';
import {
  OsmPbfFormatError,
  type OsmEntityMetadata,
  type OsmRelationMember,
  type OsmTags,
  readOsmPbf,
} from './osm-pbf-reader';
import { screenGroupRentalProperty, SCREENING_POLICY_ID } from './population-screening';
import { ProtobufDecodeError } from './protobuf-reader';
import { ROMANIAN_COUNTIES } from './romania-geography';
import { SCREENING_CONFIDENCE } from './situr-accommodation-source';
import {
  ArtifactFormatError,
  type JsonObject,
  type JsonValue,
  type ProposedClaim,
  type SourceArtifactReading,
  type SourceRecord,
} from './source-record';
import {
  cleanDisplayText,
  normalizeHouseNumber,
  normalizePropertyName,
  normalizeStreetName,
} from './text-normalization';
import { businessEmailDomain, normalizeWebsite } from './web-identity';

/**
 * Adapter for the Geofabrik Romania extract of OpenStreetMap (ODbL 1.0).
 * One record is one OSM object (node, way, or relation) tagged with an
 * accommodation `tourism=*` value. Raw Evidence keeps the original object
 * type, id, version, timestamp, tags, and geometry; county and settlement are
 * inferred from boundary relations and place nodes of the same snapshot.
 */
export const OSM_SOURCE_KEY = 'osm_geofabrik_romania';
export const OSM_PARSER_VERSION = 'osm-pbf-accommodation@1';
export const OSM_NORMALIZER_VERSION = 'osm-accommodation-normalizer@1';
export const OSM_LOCALITY_POLICY_ID = 'osm-locality-inference@1';

/** `tourism=*` values imported as possible accommodation properties. */
export const OSM_IMPORTED_TOURISM_VALUES = new Set([
  'alpine_hut',
  'apartment',
  'camp_site',
  'chalet',
  'guest_house',
  'hostel',
  'hotel',
  'motel',
]);
/** Accommodation-related values deliberately excluded, counted for the source analysis. */
const OSM_EXCLUDED_TOURISM_VALUES = new Set(['caravan_site', 'wilderness_hut', 'camp_pitch']);

interface SelectedObject extends OsmEntityMetadata {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags: OsmTags;
  lat?: number;
  lon?: number;
  refs?: number[];
  members?: OsmRelationMember[];
}

export interface OsmReadOptions {
  /** Counties whose boundaries must be present; a Romania extract must contain all of them. */
  expectedCountyCodes?: readonly string[];
}

export async function readOsmAccommodationArtifact(
  path: string,
  options: OsmReadOptions = {},
): Promise<SourceArtifactReading> {
  try {
    return await readArtifact(path, options.expectedCountyCodes ?? Object.keys(ROMANIAN_COUNTIES));
  } catch (error) {
    if (error instanceof OsmPbfFormatError || error instanceof ProtobufDecodeError) {
      throw new ArtifactFormatError('osm.invalid_pbf', error.message);
    }
    throw error;
  }
}

async function readArtifact(
  path: string,
  expectedCountyCodes: readonly string[],
): Promise<SourceArtifactReading> {
  const selected: SelectedObject[] = [];
  const places: Place[] = [];
  const boundaries: CountyBoundaryInput[] = [];
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => (excluded[reason] = (excluded[reason] ?? 0) + 1);

  const classify = (tags: OsmTags): 'import' | 'skip' => {
    const tourism = tags.tourism;
    if (tourism === undefined) return 'skip';
    if (OSM_IMPORTED_TOURISM_VALUES.has(tourism)) return 'import';
    if (OSM_EXCLUDED_TOURISM_VALUES.has(tourism)) exclude(`tourism_${tourism}`);
    return 'skip';
  };

  // Pass 1: accommodation objects, settlements, and county boundary relations.
  const header = await readOsmPbf(path, {
    node: (node) => {
      if (classify(node.tags) === 'import') selected.push({ ...node });
      const place = node.tags.place;
      const name = cleanDisplayText(node.tags.name);
      if (isPlaceType(place) && name !== null) {
        places.push({
          osmNodeId: node.id,
          name,
          keys: placeKeys(node.tags),
          type: place,
          point: [node.lon, node.lat],
        });
      }
    },
    way: (way) => {
      if (classify(way.tags) === 'import') selected.push({ ...way });
    },
    relation: (relation) => {
      if (classify(relation.tags) === 'import') selected.push({ ...relation });
      const iso = relation.tags['ISO3166-2'];
      if (
        relation.tags.boundary === 'administrative' &&
        relation.tags.admin_level === '4' &&
        iso?.startsWith('RO-') === true
      ) {
        boundaries.push({
          relationId: relation.id,
          isoCode: iso,
          members: relation.members
            .filter((member) => member.type === 'way')
            .map((member) => ({ wayId: member.ref, role: member.role })),
        });
      }
    },
  });
  if (header.replicationTimestamp === null) {
    throw new ArtifactFormatError(
      'osm.missing_replication_timestamp',
      'The extract header does not state its data version',
    );
  }

  // Pass 2: member ways of selected relations and of county boundaries.
  const neededWays = new Set<number>([
    ...boundaries.flatMap((boundary) => boundary.members.map((member) => member.wayId)),
    ...selected.flatMap((object) =>
      (object.members ?? []).filter((member) => member.type === 'way').map((member) => member.ref),
    ),
  ]);
  const wayRefs = new Map<number, number[]>();
  for (const object of selected) if (object.refs !== undefined) wayRefs.set(object.id, object.refs);
  await readOsmPbf(path, {
    way: (way) => {
      if (neededWays.has(way.id)) wayRefs.set(way.id, way.refs);
    },
  });

  // Pass 3: coordinates of every node the selected geometry depends on.
  const neededNodes = new Set<number>();
  for (const refs of wayRefs.values()) for (const ref of refs) neededNodes.add(ref);
  for (const object of selected) {
    for (const member of object.members ?? []) {
      if (member.type === 'node') neededNodes.add(member.ref);
    }
  }
  const coordinates = new Map<number, LonLat>();
  await readOsmPbf(path, {
    node: (node) => {
      if (neededNodes.has(node.id)) coordinates.set(node.id, [node.lon, node.lat]);
    },
  });

  const counties = buildCountyPolygons(boundaries, wayRefs, coordinates);
  const missingCounties = expectedCountyCodes.filter(
    (code) => !counties.some((county) => county.countyCode === code),
  );
  if (missingCounties.length > 0) {
    throw new ArtifactFormatError(
      'osm.incomplete_county_boundaries',
      `County boundaries could not be assembled for ${missingCounties.join(', ')}`,
    );
  }
  const gazetteer = new PlaceGazetteer(places);
  const observedAt = new Date(header.replicationTimestamp);

  const records: SourceRecord[] = [];
  selected
    .sort((left, right) => typeOrder(left.type) - typeOrder(right.type) || left.id - right.id)
    .forEach((object, index) => {
      const geometry = geometryOf(object, wayRefs, coordinates);
      const county = geometry === null ? null : locateCounty(geometry.point, counties);
      if (geometry !== null && county === null) {
        exclude('outside_romania');
        return;
      }
      records.push(
        toRecord(
          index + 1,
          object,
          geometry,
          county,
          geometry === null ? [] : gazetteer.nearby(geometry.point),
        ),
      );
    });

  return {
    sourceKey: OSM_SOURCE_KEY,
    datasetVersion: header.replicationTimestamp,
    observedAt,
    parserVersion: OSM_PARSER_VERSION,
    normalizerVersion: OSM_NORMALIZER_VERSION,
    metadata: {
      writingProgram: header.writingProgram,
      requiredFeatures: header.requiredFeatures,
      optionalFeatures: header.optionalFeatures,
      replicationTimestamp: header.replicationTimestamp,
      replicationSequenceNumber: header.replicationSequenceNumber,
      replicationBaseUrl: header.replicationBaseUrl,
      countyBoundaryRelations: counties.map((county) => county.relationId).sort((a, b) => a - b),
      placeNodes: places.length,
    },
    records,
    excluded,
  };
}

function typeOrder(type: SelectedObject['type']): number {
  return type === 'node' ? 0 : type === 'way' ? 1 : 2;
}

interface Geometry {
  point: LonLat;
  precision: 'node' | 'way_vertex_mean' | 'relation_vertex_mean';
  coordinates: LonLat[];
}

function vertexMean(points: LonLat[]): LonLat {
  const unique =
    points.length > 1 &&
    points[0]?.[0] === points.at(-1)?.[0] &&
    points[0]?.[1] === points.at(-1)?.[1]
      ? points.slice(0, -1)
      : points;
  const lon = unique.reduce((sum, [value]) => sum + value, 0) / unique.length;
  const lat = unique.reduce((sum, [, value]) => sum + value, 0) / unique.length;
  return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
}

function geometryOf(
  object: SelectedObject,
  wayRefs: ReadonlyMap<number, number[]>,
  coordinates: ReadonlyMap<number, LonLat>,
): Geometry | null {
  if (object.type === 'node' && object.lon !== undefined && object.lat !== undefined) {
    return { point: [object.lon, object.lat], precision: 'node', coordinates: [] };
  }
  const resolve = (refs: number[]) =>
    refs.map((ref) => coordinates.get(ref)).filter((point): point is LonLat => point !== undefined);
  if (object.type === 'way') {
    const points = resolve(object.refs ?? []);
    return points.length === 0
      ? null
      : { point: vertexMean(points), precision: 'way_vertex_mean', coordinates: points };
  }
  const points = (object.members ?? []).flatMap((member) => {
    if (member.type === 'node') {
      const point = coordinates.get(member.ref);
      return point === undefined ? [] : [point];
    }
    if (member.type === 'way' && member.role !== 'inner')
      return resolve(wayRefs.get(member.ref) ?? []);
    return [];
  });
  return points.length === 0
    ? null
    : { point: vertexMean(points), precision: 'relation_vertex_mean', coordinates: [] };
}

function rawPayloadOf(object: SelectedObject, geometry: Geometry | null): JsonObject {
  const payload: JsonObject = {
    type: object.type,
    id: object.id,
    version: object.version,
    timestamp: object.timestamp === null ? null : new Date(object.timestamp).toISOString(),
    tags: { ...object.tags },
  };
  if (object.type === 'node') {
    payload.lat = object.lat ?? null;
    payload.lon = object.lon ?? null;
  } else if (object.type === 'way') {
    payload.nodeRefs = object.refs ?? [];
    payload.coordinates = (geometry?.coordinates ?? []).map(([lon, lat]) => [lon, lat]);
  } else {
    payload.members = (object.members ?? []).map((member) => ({ ...member }));
  }
  return payload;
}

function parseCount(value: string | undefined): number | null {
  const cleaned = value?.trim() ?? '';
  return /^\d{1,5}$/.test(cleaned) ? Number(cleaned) : null;
}

function toRecord(
  position: number,
  object: SelectedObject,
  geometry: Geometry | null,
  county: ReturnType<typeof locateCounty>,
  nearby: NearbyPlace[],
): SourceRecord {
  const tags = object.tags;
  const sourceRecordKey = `${object.type}/${String(object.id)}`;
  const record: SourceRecord = {
    sourceRecordKey,
    sourceRecordUrl: `https://www.openstreetmap.org/${sourceRecordKey}`,
    position,
    rawPayload: rawPayloadOf(object, geometry),
    redactedFields: [],
    status: 'parsed',
    errors: [],
    claims: [],
    summary: null,
    scopeSettlements: [],
  };

  if (geometry === null || county === null) {
    record.status = 'rejected';
    record.errors.push({
      code: 'missing_geometry',
      message: 'Object coordinates could not be resolved from the extract',
    });
    return record;
  }

  const name = cleanDisplayText(tags.name) ?? cleanDisplayText(tags['name:ro']);
  const tourism = tags.tourism ?? '';
  const addrSettlement =
    cleanDisplayText(tags['addr:city']) ??
    cleanDisplayText(tags['addr:place']) ??
    cleanDisplayText(tags['addr:village']);
  const nearest = nearby[0];
  const settlementName = addrSettlement ?? nearest?.name ?? null;
  const urbanity = urbanityFromNearby(nearby);
  const normalizedName = normalizePropertyName(name ?? '');
  const capacity = parseCount(tags.capacity) ?? parseCount(tags.beds);
  const screening = screenGroupRentalProperty({
    structureType: `osm:${tourism}`,
    sleepsPersons: capacity,
    urbanity,
    nameTypeWords: normalizedName.typeWords,
    apartmentBuilding: false,
    campSiteHasCabins: tags.cabins === 'yes',
  });

  const claims: ProposedClaim[] = [];
  const add = (target: string, value: JsonValue, fields: string[], confidence = 0.9) => {
    if (value === null) return;
    claims.push({ target, value, locator: { type: 'structured_field', fields }, confidence });
  };

  add('offer.name', name, tags.name === undefined ? ['tags.name:ro'] : ['tags.name']);
  const alternativeNames = ['alt_name', 'old_name', 'official_name', 'name:en', 'name:hu', 'brand']
    .flatMap((key) => (tags[key] ?? '').split(';'))
    .map(cleanDisplayText)
    .filter((value): value is string => value !== null && value !== name);
  if (alternativeNames.length > 0) {
    add(
      'offer.alternative_names',
      [...new Set(alternativeNames)],
      [
        'tags.alt_name',
        'tags.old_name',
        'tags.official_name',
        'tags.name:en',
        'tags.name:hu',
        'tags.brand',
      ],
    );
  }
  add('offer.osm_tourism_type', { tourism, guestHouse: tags.guest_house ?? null }, [
    'tags.tourism',
    'tags.guest_house',
  ]);
  add(
    'offer.coordinates',
    { lat: geometry.point[1], lon: geometry.point[0], precision: geometry.precision },
    object.type === 'node' ? ['lat', 'lon'] : ['coordinates'],
  );

  claims.push({
    target: 'offer.primary_locality',
    value: {
      countyCode: county.countyCode,
      settlementName,
      settlementSource:
        addrSettlement !== null ? 'address_tag' : nearest !== undefined ? 'nearest_place' : null,
      urbanity,
    },
    locator: {
      type: 'inferred',
      policyId: OSM_LOCALITY_POLICY_ID,
      rationale:
        'County from the enclosing admin_level=4 boundary; settlement from addr:* tags or the nearest place node within its type radius',
      inputs: {
        countyBoundaryRelationId: county.relationId,
        addressSettlement: addrSettlement,
        nearestPlace:
          nearest === undefined
            ? null
            : {
                osmNodeId: nearest.osmNodeId,
                name: nearest.name,
                type: nearest.type,
                distanceKm: nearest.distanceKm,
              },
      },
    },
    confidence: addrSettlement !== null ? 0.85 : 0.6,
    extractionMethod: OSM_LOCALITY_POLICY_ID,
  });
  if (nearby.length > 0) {
    claims.push({
      target: 'offer.nearby_settlements',
      value: nearby.map((place) => ({
        osmNodeId: place.osmNodeId,
        name: place.name,
        keys: place.keys,
        type: place.type,
        distanceKm: place.distanceKm,
      })),
      locator: {
        type: 'inferred',
        policyId: OSM_LOCALITY_POLICY_ID,
        rationale: 'Place nodes whose type-specific radius contains the object',
        inputs: { point: [geometry.point[0], geometry.point[1]] },
      },
      confidence: 0.6,
      extractionMethod: OSM_LOCALITY_POLICY_ID,
    });
  }

  const street = cleanDisplayText(tags['addr:street']);
  const houseNumber = cleanDisplayText(tags['addr:housenumber']);
  if (street !== null || houseNumber !== null) {
    add(
      'offer.address',
      {
        street,
        streetKey: street === null ? null : normalizeStreetName(street),
        houseNumber,
        houseNumberKey: houseNumber === null ? null : normalizeHouseNumber(houseNumber),
        apartmentBuilding: false,
        raw: [street, houseNumber].filter((part) => part !== null).join(' '),
      },
      ['tags.addr:street', 'tags.addr:housenumber'],
    );
  }

  const websites = ['website', 'contact:website', 'url', 'contact:facebook', 'facebook']
    .map((key) => normalizeWebsite(tags[key]))
    .filter((website) => website !== null);
  if (websites.length > 0) {
    const unique = [...new Map(websites.map((website) => [website.identityKey, website])).values()];
    add(
      'offer.website',
      unique.map((website) => ({ ...website })),
      [
        'tags.website',
        'tags.contact:website',
        'tags.url',
        'tags.contact:facebook',
        'tags.facebook',
      ],
    );
  }
  add('offer.business_email_domain', businessEmailDomain(tags.email ?? tags['contact:email']), [
    'tags.email',
    'tags.contact:email',
  ]);
  add('offer.rooms_count', parseCount(tags.rooms), ['tags.rooms']);
  add('offer.beds_count', parseCount(tags.beds), ['tags.beds']);
  add('offer.capacity_persons', parseCount(tags.capacity), ['tags.capacity']);
  add('provider_hint.operator', cleanDisplayText(tags.operator), ['tags.operator']);
  const vatin = /^(?:RO)?\s*(\d{2,10})$/i.exec(tags['ref:vatin']?.trim() ?? '');
  add('provider_hint.tax_id', vatin?.[1] ?? null, ['tags.ref:vatin']);

  claims.push({
    target: 'offer.population_screening',
    value: { class: screening.screeningClass, reasons: screening.reasons },
    locator: {
      type: 'inferred',
      policyId: SCREENING_POLICY_ID,
      rationale: screening.reasons.join(', '),
      inputs: {
        structureType: `osm:${tourism}`,
        sleepsPersons: capacity,
        urbanity,
        nameTypeWords: normalizedName.typeWords,
        campSiteHasCabins: tags.cabins === 'yes',
      },
    },
    confidence: SCREENING_CONFIDENCE[screening.screeningClass],
    extractionMethod: SCREENING_POLICY_ID,
  });

  record.claims = claims;
  record.summary = {
    displayName: name ?? `${tourism} ${sourceRecordKey}`,
    countyCode: county.countyCode,
    settlementName,
    screeningClass: screening.screeningClass,
  };
  record.scopeSettlements = [
    ...(addrSettlement === null ? [] : [addrSettlement]),
    ...nearby.map((place) => place.name),
  ];
  return record;
}
