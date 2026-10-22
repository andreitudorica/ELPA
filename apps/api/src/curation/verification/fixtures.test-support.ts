import { createHash } from 'node:crypto';

import type { ClaimSnapshot, EvidenceSnapshot, Subject } from './contracts';
import { categoryOf } from './validator';

const hex = (seed: string) => createHash('sha256').update(seed).digest('hex');
/** Deterministic, valid-looking UUIDs for synthetic fixtures. */
export const uuid = (seed: string) => {
  const h = hex(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export const COUNTIES = { 'RO-CJ': 'Cluj', 'RO-BV': 'Brașov', 'RO-CS': 'Caraș-Severin' };
export const AS_OF = '2026-10-22T00:00:00.000Z';

export function evidence(
  id: string,
  sourceKey: string,
  fields: [string, string | null][],
  overrides: Partial<EvidenceSnapshot['artifact']> = {},
): EvidenceSnapshot {
  return {
    id: uuid(id),
    sourceKey,
    sourceRecordKey: `record-${id}`,
    contentSha256: hex(`content-${id}`),
    fields: fields.map(([name, text]) => ({
      path: name.startsWith('tags.') ? ['tags', name.slice(5)] : [name],
      text,
      withheld: text === null ? 'missing' : 'none',
    })),
    artifact: {
      id: uuid(`artifact-${sourceKey}`),
      sha256: hex(`artifact-${sourceKey}`),
      datasetVersion: '2026-10-21',
      latestDatasetVersion: '2026-10-21',
      retrievedAt: '2026-10-21T10:00:00.000Z',
      reuseTerms:
        sourceKey === 'osm_geofabrik_romania'
          ? 'odbl_1_0'
          : 'ro_public_register_no_explicit_licence',
      retentionPolicy: 'personal_data_redacted',
      ...overrides,
    },
  };
}

export function claim(
  id: string,
  candidate: string,
  evidenceId: string,
  target: string,
  value: ClaimSnapshot['value'],
  locator: ClaimSnapshot['locator'],
  overrides: Partial<ClaimSnapshot> = {},
): ClaimSnapshot {
  return {
    claimId: uuid(id),
    candidateId: uuid(candidate),
    evidenceId: uuid(evidenceId),
    target,
    value,
    locator,
    method: 'situr-accommodation-normalizer@1',
    methodCurrent: true,
    evidenceLatest: true,
    grounding: 'not_applicable',
    observedAt: '2026-10-21T00:00:00.000Z',
    extractedAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  };
}

const LOCALITY_FIELDS = ['Localitate', 'Județ', 'Tip localitate', 'Localitate componentă'];

/** A register locality Claim: Cluj-Napoca, Cluj, unless overridden. */
export function registerLocality(
  options: {
    countyCode?: string;
    settlement?: string | null;
    claim?: Partial<ClaimSnapshot>;
    artifact?: Partial<EvidenceSnapshot['artifact']>;
    counterparts?: Subject['counterparts'];
    extraEvidence?: EvidenceSnapshot[];
    siblings?: ClaimSnapshot[];
  } = {},
): Subject {
  const ev = evidence(
    'register-1',
    'situr_accommodation_register',
    [
      ['Localitate', options.settlement ?? 'Cluj-Napoca'],
      ['Județ', 'CLUJ'],
      ['Tip localitate', 'municipiu'],
      ['Localitate componentă', ''],
    ],
    options.artifact,
  );
  ev.fields[3] = { path: ['Localitate componentă'], text: null, withheld: 'missing' };
  ev.fields = ev.fields.filter((f) => f.withheld === 'none');
  const own = claim(
    'register-claim',
    'register-candidate',
    'register-1',
    'offer.primary_locality',
    {
      countyCode: options.countyCode ?? 'RO-CJ',
      settlementName: options.settlement === undefined ? 'Cluj-Napoca' : options.settlement,
    },
    { type: 'structured_field', fields: LOCALITY_FIELDS.slice(0, 3) },
    options.claim,
  );
  return {
    itemId: hex(`item-${own.claimId}`),
    category: categoryOf(own, 'situr_accommodation_register'),
    candidate: {
      id: uuid('register-candidate'),
      sourceKey: 'situr_accommodation_register',
      sourceRecordKey: 'record-register-1',
      displayName: 'Cabana Test',
    },
    claim: own,
    siblings: options.siblings ?? [],
    counterparts: options.counterparts ?? [],
    evidence: [ev, ...(options.extraEvidence ?? [])],
    conditions: [],
  };
}

/** An OSM county inference for a candidate whose retained tags are given. */
export function osmCounty(
  options: {
    countyCode?: string;
    tags?: [string, string | null][];
    counterparts?: Subject['counterparts'];
    extraEvidence?: EvidenceSnapshot[];
  } = {},
): Subject {
  const ev = evidence('osm-1', 'osm_geofabrik_romania', [
    ['lat', '46.77'],
    ['lon', '23.6'],
    ...(options.tags ?? []),
  ]);
  ev.artifact.datasetVersion = '2026-10-19T20:21:11Z';
  ev.artifact.latestDatasetVersion = '2026-10-19T20:21:11Z';
  const own = claim(
    'osm-claim',
    'osm-candidate',
    'osm-1',
    'offer.primary_locality',
    {
      countyCode: options.countyCode ?? 'RO-CJ',
      settlementName: 'Florești',
      settlementSource: 'nearest_place',
    },
    {
      type: 'inferred',
      policyId: 'osm-locality-inference@1',
      rationale: 'County from the enclosing boundary',
      inputs: { countyBoundaryRelationId: 1, addressSettlement: null, nearestPlace: null },
    },
    { method: 'osm-locality-inference@1', observedAt: '2026-10-19T20:21:11.000Z' },
  );
  return {
    itemId: hex(`item-${own.claimId}`),
    category: categoryOf(own, 'osm_geofabrik_romania'),
    candidate: {
      id: uuid('osm-candidate'),
      sourceKey: 'osm_geofabrik_romania',
      sourceRecordKey: 'record-osm-1',
      displayName: 'Casa Test',
    },
    claim: own,
    siblings: [],
    counterparts: options.counterparts ?? [],
    evidence: [ev, ...(options.extraEvidence ?? [])],
    conditions: [],
  };
}

/** A grounded text-span facility Claim from an OSM description. */
export function textFacility(
  attribute: string,
  quote: string,
  locator: Partial<Record<string, ClaimSnapshot['value']>> = {},
  overrides: Partial<ClaimSnapshot> = {},
): Subject {
  const description = `Proprietate cu ${quote} și curte mare.`;
  const ev = evidence('osm-text', 'osm_geofabrik_romania', [['tags.description', description]]);
  ev.artifact.datasetVersion = '2026-10-19T20:21:11Z';
  ev.artifact.latestDatasetVersion = '2026-10-19T20:21:11Z';
  const own = claim(
    `text-${attribute}`,
    'text-candidate',
    'osm-text',
    `offer.${attribute}`,
    true,
    {
      type: 'text_span',
      fieldPath: ['tags', 'description'],
      quote,
      start: 15,
      end: 15 + quote.length,
      entityLevel: 'offer',
      scope: 'advertised_accommodation',
      ambiguity: 'none',
      temporal: { kind: 'unspecified', text: null },
      explicitness: 'explicit',
      ...locator,
    },
    { method: 'grp-text-rules@2', grounding: 'valid', ...overrides },
  );
  return {
    itemId: hex(`item-${own.claimId}`),
    category: categoryOf(own, 'osm_geofabrik_romania'),
    candidate: {
      id: uuid('text-candidate'),
      sourceKey: 'osm_geofabrik_romania',
      sourceRecordKey: 'record-osm-text',
      displayName: 'Vila Test',
    },
    claim: own,
    siblings: [],
    counterparts: [],
    evidence: [ev],
    conditions: [],
  };
}
