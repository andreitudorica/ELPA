import type { JsonValue, SourceKey } from '../acquisition/source-record';
import { foldText } from '../acquisition/text-normalization';
import type { MatchFeatures } from './duplicate-matcher';

/**
 * Builds matcher inputs from a Candidate's latest Claims. Only proposed
 * Claims are read; the matcher therefore sees exactly what a reviewer can
 * inspect in Data Studio.
 */
export const MATCH_CLAIM_TARGETS = [
  'offer.name',
  'offer.alternative_names',
  'offer.primary_locality',
  'offer.nearby_settlements',
  'offer.coordinates',
  'offer.address',
  'offer.website',
  'offer.business_email_domain',
  'offer.registry_certificate',
  'offer.registry_structure_type',
  'offer.osm_tourism_type',
  'offer.sleeps_persons',
  'offer.capacity_persons',
  'provider_hint.tax_id',
] as const;

type ClaimValues = Partial<Record<(typeof MATCH_CLAIM_TARGETS)[number], JsonValue>>;

function record(value: JsonValue | undefined): Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function count(value: JsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

export function matchFeaturesFromClaims(
  candidate: {
    id: string;
    sourceKey: SourceKey;
    sourceRecordKey: string;
    countyCode: string | null;
  },
  claims: ClaimValues,
): MatchFeatures {
  const locality = record(claims['offer.primary_locality']);
  const settlementKeys =
    candidate.sourceKey === 'situr_accommodation_register'
      ? [text(locality.settlementName), text(locality.uatName)]
      : locality.settlementSource === 'address_tag'
        ? [text(locality.settlementName)]
        : [];

  const nearby = Array.isArray(claims['offer.nearby_settlements'])
    ? claims['offer.nearby_settlements'].flatMap((place) => {
        const entry = record(place);
        const name = text(entry.name);
        const distance = count(entry.distanceKm);
        const keys = Array.isArray(entry.keys)
          ? entry.keys.filter((key) => typeof key === 'string')
          : [];
        return name === null || distance === null
          ? []
          : keys.map((key) => ({ key, name, distanceKm: distance }));
      })
    : [];

  const coordinates = record(claims['offer.coordinates']);
  const lat = count(coordinates.lat);
  const lon = count(coordinates.lon);
  const address = record(claims['offer.address']);
  const websites = Array.isArray(claims['offer.website'])
    ? claims['offer.website'].flatMap((site) => {
        const entry = record(site);
        const identityKey = text(entry.identityKey);
        return identityKey === null ? [] : [{ identityKey, platform: entry.platform === true }];
      })
    : [];
  const alternativeNames = Array.isArray(claims['offer.alternative_names'])
    ? claims['offer.alternative_names'].filter((name) => typeof name === 'string')
    : [];
  const registerType = text(record(claims['offer.registry_structure_type']).key);
  const tourism = text(record(claims['offer.osm_tourism_type']).tourism);

  const primarySettlement = settlementKeys[0] ?? null;
  return {
    candidateId: candidate.id,
    sourceKey: candidate.sourceKey,
    sourceRecordKey: candidate.sourceRecordKey,
    names: [text(claims['offer.name']), ...alternativeNames].filter((name) => name !== null),
    countyCode: candidate.countyCode,
    primarySettlementKey: primarySettlement === null ? null : foldText(primarySettlement) || null,
    settlementKeys: [
      ...new Set(
        settlementKeys
          .filter((key) => key !== null)
          .map(foldText)
          .filter((key) => key !== ''),
      ),
    ],
    nearbySettlements: nearby,
    point: lat !== null && lon !== null ? [lon, lat] : null,
    streetKey: text(address.streetKey),
    houseNumberKey: text(address.houseNumberKey),
    websites,
    emailDomain: text(claims['offer.business_email_domain']),
    taxId: text(claims['provider_hint.tax_id']),
    certificateNumber: text(record(claims['offer.registry_certificate']).number),
    structureType:
      registerType !== null ? `situr:${registerType}` : tourism !== null ? `osm:${tourism}` : null,
    sleepsPersons: count(claims['offer.sleeps_persons']) ?? count(claims['offer.capacity_persons']),
  };
}
