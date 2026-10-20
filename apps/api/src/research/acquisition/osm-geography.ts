import { type CountyCode, isCountyCode } from './romania-geography';
import { foldText } from './text-normalization';

/**
 * Geography derived from the same OpenStreetMap snapshot as the imported
 * accommodation objects: county polygons from `admin_level=4` boundary
 * relations and a settlement gazetteer from `place=*` nodes. Both are used to
 * produce inferred locality Claims; neither is imported as Evidence.
 */

export type LonLat = readonly [number, number];

export interface CountyBoundaryInput {
  relationId: number;
  isoCode: string;
  members: { wayId: number; role: string }[];
}

export interface CountyPolygon {
  relationId: number;
  countyCode: CountyCode;
  outer: LonLat[][];
  inner: LonLat[][];
  bbox: [number, number, number, number];
}

/** Joins boundary member ways into closed rings by shared end nodes. */
export function assembleRings(ways: number[][]): number[][] {
  const pool = ways.filter((way) => way.length >= 2).map((way) => [...way]);
  const rings: number[][] = [];
  while (pool.length > 0) {
    const ring = pool.pop() ?? [];
    let extended = true;
    while (ring[0] !== ring.at(-1) && extended) {
      extended = false;
      const end = ring.at(-1);
      for (let index = 0; index < pool.length; index += 1) {
        const way = pool[index] ?? [];
        if (way[0] === end) ring.push(...way.slice(1));
        else if (way.at(-1) === end) ring.push(...way.slice(0, -1).reverse());
        else continue;
        pool.splice(index, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && ring[0] === ring.at(-1)) rings.push(ring);
  }
  return rings;
}

export function buildCountyPolygons(
  boundaries: CountyBoundaryInput[],
  wayRefs: ReadonlyMap<number, number[]>,
  nodes: ReadonlyMap<number, LonLat>,
): CountyPolygon[] {
  const polygons: CountyPolygon[] = [];
  for (const boundary of boundaries) {
    if (!isCountyCode(boundary.isoCode)) continue;
    const ringsFor = (roles: string[]) =>
      assembleRings(
        boundary.members
          .filter((member) => roles.includes(member.role))
          .map((member) => wayRefs.get(member.wayId))
          .filter((refs): refs is number[] => refs !== undefined),
      ).map((ring) =>
        ring.map((ref) => nodes.get(ref)).filter((point): point is LonLat => point !== undefined),
      );
    const outer = ringsFor(['outer', '']);
    if (outer.length === 0) continue;
    polygons.push({
      relationId: boundary.relationId,
      countyCode: boundary.isoCode,
      outer,
      inner: ringsFor(['inner']),
      bbox: boundingBox(outer.flat()),
    });
  }
  return polygons;
}

function boundingBox(points: LonLat[]): [number, number, number, number] {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of points) {
    box[0] = Math.min(box[0], lon);
    box[1] = Math.min(box[1], lat);
    box[2] = Math.max(box[2], lon);
    box[3] = Math.max(box[3], lat);
  }
  return box;
}

function insideRing(point: LonLat, ring: LonLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function locateCounty(point: LonLat, polygons: CountyPolygon[]): CountyPolygon | null {
  const [lon, lat] = point;
  for (const polygon of polygons) {
    const [minLon, minLat, maxLon, maxLat] = polygon.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (
      polygon.outer.some((ring) => insideRing(point, ring)) &&
      !polygon.inner.some((ring) => insideRing(point, ring))
    ) {
      return polygon;
    }
  }
  return null;
}

export function distanceKm(from: LonLat, to: LonLat): number {
  const radians = Math.PI / 180;
  const dLat = (to[1] - from[1]) * radians;
  const dLon = (to[0] - from[0]) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Search radius per settlement type: a property this close is "near" the place. */
export const PLACE_RADIUS_KM = {
  city: 12,
  town: 6,
  village: 5,
  hamlet: 2,
  suburb: 2,
  quarter: 1.5,
  neighbourhood: 1,
  isolated_dwelling: 1,
} as const;

export type PlaceType = keyof typeof PLACE_RADIUS_KM;
const URBAN_PLACE_TYPES = new Set<PlaceType>([
  'city',
  'town',
  'suburb',
  'quarter',
  'neighbourhood',
]);

export function isPlaceType(value: string | undefined): value is PlaceType {
  return value !== undefined && Object.hasOwn(PLACE_RADIUS_KM, value);
}

export interface Place {
  osmNodeId: number;
  name: string;
  /** Folded name plus folded alternative names. */
  keys: string[];
  type: PlaceType;
  point: LonLat;
}

export interface NearbyPlace {
  osmNodeId: number;
  name: string;
  keys: string[];
  type: PlaceType;
  distanceKm: number;
}

const GRID_DEGREES = 0.1;
const MAX_RADIUS_KM = Math.max(...Object.values(PLACE_RADIUS_KM));

export class PlaceGazetteer {
  private readonly cells = new Map<string, Place[]>();

  constructor(places: Place[]) {
    for (const place of places) {
      const key = this.cellKey(place.point);
      const cell = this.cells.get(key) ?? [];
      cell.push(place);
      this.cells.set(key, cell);
    }
  }

  /** Places whose type-specific radius contains the point, nearest first. */
  nearby(point: LonLat, limit = 8): NearbyPlace[] {
    const span = Math.ceil(
      MAX_RADIUS_KM / 111 / GRID_DEGREES / Math.cos((point[1] * Math.PI) / 180),
    );
    const [cellX, cellY] = this.cellIndex(point);
    const found: NearbyPlace[] = [];
    for (let dx = -span; dx <= span; dx += 1) {
      for (let dy = -span; dy <= span; dy += 1) {
        for (const place of this.cells.get(`${String(cellX + dx)}:${String(cellY + dy)}`) ?? []) {
          const distance = distanceKm(point, place.point);
          if (distance <= PLACE_RADIUS_KM[place.type]) {
            found.push({
              osmNodeId: place.osmNodeId,
              name: place.name,
              keys: place.keys,
              type: place.type,
              distanceKm: Math.round(distance * 100) / 100,
            });
          }
        }
      }
    }
    return found
      .sort((left, right) => left.distanceKm - right.distanceKm || left.osmNodeId - right.osmNodeId)
      .slice(0, limit);
  }

  private cellIndex(point: LonLat): [number, number] {
    return [Math.floor(point[0] / GRID_DEGREES), Math.floor(point[1] / GRID_DEGREES)];
  }

  private cellKey(point: LonLat): string {
    const [x, y] = this.cellIndex(point);
    return `${String(x)}:${String(y)}`;
  }
}

/** Urban when the nearest settlement within range is urban; remote objects count as rural. */
export function urbanityFromNearby(nearby: NearbyPlace[]): 'urban' | 'rural' {
  const nearest = nearby[0];
  return nearest !== undefined && URBAN_PLACE_TYPES.has(nearest.type) ? 'urban' : 'rural';
}

export function placeKeys(tags: Readonly<Record<string, string>>): string[] {
  return [
    ...new Set(
      ['name', 'name:ro', 'alt_name', 'old_name', 'official_name']
        .flatMap((key) => (tags[key] ?? '').split(';'))
        .map(foldText)
        .filter((key) => key !== ''),
    ),
  ];
}
