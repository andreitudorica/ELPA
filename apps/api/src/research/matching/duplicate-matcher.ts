import { distanceKm, type LonLat } from '../acquisition/osm-geography';
import type { JsonObject, SourceKey } from '../acquisition/source-record';
import { normalizePropertyName, trigramSimilarity } from '../acquisition/text-normalization';

/**
 * Conservative first-stage entity resolution for property Candidates.
 *
 * The matcher separates three steps:
 *  1. candidate generation (blocking): which pairs are worth comparing;
 *  2. signal scoring: explainable evidence for and against each pair;
 *  3. decisions: `likely` / `possible` suggestions, or nothing.
 *
 * It never merges. Shared operator identifiers (tax id, website domain,
 * email domain) are Provider-level evidence and never by themselves make two
 * records the same property. Rules and thresholds were set on the tuning
 * partition only and are documented in
 * docs/research/group-rental-property-baseline/entity-resolution.md.
 */
export const MATCHER_VERSION = 'grp-duplicate-matcher@1';

/** Core names shared by more Candidates than this in one county are too common to trust. */
export const COUNTY_COMMON_NAME_THRESHOLD = 3;
/** Core names shared by more Candidates than this nationally are too common to trust. */
export const NATIONAL_COMMON_NAME_THRESHOLD = 10;
/** Shorter core names (`AP`, `ANA`) carry too little identity for a `likely` match. */
export const MIN_INFORMATIVE_CORE_LENGTH = 4;
export const NAME_SIMILARITY_POSSIBLE = 0.6;
export const NAME_SIMILARITY_WITH_ADDRESS = 0.5;
/** Register rows in one settlement need near-identical names to be compared at all. */
export const REGISTER_NAME_SIMILARITY_POSSIBLE = 0.85;
/** Two mapped OSM objects this close describe the same footprint. */
export const SAME_SITE_DISTANCE_KM = 0.25;
/** Token blocks larger than this are not discriminative and are skipped. */
const MAX_TOKEN_BLOCK = 400;
/**
 * Identifiers (website, email domain, tax id) shared by more Candidates than
 * this belong to chains, property managers, or platforms: they are reported
 * but not treated as evidence that two records share a Provider.
 */
export const BROAD_IDENTIFIER_THRESHOLD = 50;

export interface MatchFeatures {
  candidateId: string;
  sourceKey: SourceKey;
  sourceRecordKey: string;
  names: string[];
  countyCode: string | null;
  /** Most specific settlement stated by the source (register village/town, OSM addr:city). */
  primarySettlementKey: string | null;
  /** Every folded settlement name stated by the source, including the register UAT. */
  settlementKeys: string[];
  /** Folded OSM place names near the object, with distances. */
  nearbySettlements: { key: string; name: string; distanceKm: number }[];
  point: LonLat | null;
  streetKey: string | null;
  houseNumberKey: string | null;
  websites: { identityKey: string; platform: boolean }[];
  emailDomain: string | null;
  taxId: string | null;
  certificateNumber: string | null;
  /** `situr:<type>` or `osm:<tourism>`. */
  structureType: string | null;
  sleepsPersons: number | null;
}

export type MatchRelation = 'same_property' | 'same_provider';
export type MatchStrength = 'likely' | 'possible';

export interface DuplicateSuggestionDraft {
  leftCandidateId: string;
  rightCandidateId: string;
  relation: MatchRelation;
  strength: MatchStrength;
  score: number;
  signals: JsonObject;
}

interface NameVariant {
  /** Identifying words without type words, stop words, or unit numbers. */
  core: string;
  /** Unit numbers such as `2`, `12a`, or roman numerals: `ap 2` is not `ap 5`. */
  numbers: string;
}

export interface PreparedCandidate {
  features: MatchFeatures;
  variants: NameVariant[];
  typeWords: string[];
  blockingTokens: Set<string>;
}

const UNIT_NUMBER = /^(\d+[a-z]?|[ivx]{1,4})$/;

const TYPE_WORD_GROUPS: Record<string, string> = {
  apartament: 'apartment',
  apartamente: 'apartment',
  apartamentul: 'apartment',
  apartment: 'apartment',
  apartments: 'apartment',
  studio: 'apartment',
  studiouri: 'apartment',
  hotel: 'hotel',
  hotelul: 'hotel',
  motel: 'hotel',
  hostel: 'hostel',
  pensiune: 'guest_house',
  pensiunea: 'guest_house',
  panzio: 'guest_house',
  vendeghaz: 'guest_house',
  guest: 'guest_house',
  guesthouse: 'guest_house',
  agroturistica: 'guest_house',
  agroturistic: 'guest_house',
  camping: 'camping',
  popas: 'camping',
  bungalou: 'camping',
  bungalouri: 'camping',
  bungalow: 'camping',
  bungalows: 'camping',
};

/** Register structure types compatible with each OSM tourism value. */
const COMPATIBLE_TYPES: Record<string, string[]> = {
  'osm:guest_house': [
    'pensiune_turistica',
    'pensiune_agroturistica',
    'vila_turistica',
    'camere_de_inchiriat',
    'apartamente_de_inchiriat',
    'cabana_turistica',
  ],
  'osm:chalet': [
    'cabana_turistica',
    'vila_turistica',
    'camere_de_inchiriat',
    'casute_tip_camping',
    'bungalouri',
    'sat_de_vacanta',
    'pensiune_turistica',
    'pensiune_agroturistica',
    'apartamente_de_inchiriat',
  ],
  'osm:apartment': ['apartamente_de_inchiriat', 'camere_de_inchiriat', 'vila_turistica'],
  'osm:hotel': ['hotel', 'hotel_apartament', 'motel', 'vila_turistica', 'pensiune_turistica'],
  'osm:motel': ['motel', 'hotel', 'popas_turistic', 'pensiune_turistica'],
  'osm:hostel': ['hostel', 'camere_de_inchiriat', 'pensiune_turistica'],
  'osm:alpine_hut': ['cabana_turistica', 'pensiune_turistica', 'pensiune_agroturistica'],
  'osm:camp_site': [
    'camping',
    'casute_tip_camping',
    'bungalouri',
    'spatii_de_campare',
    'popas_turistic',
    'sat_de_vacanta',
  ],
};

export function prepareCandidate(features: MatchFeatures): PreparedCandidate {
  const normalized = features.names.map(normalizePropertyName);
  const variants = new Map<string, NameVariant>();
  for (const name of normalized) {
    const words = name.coreTokens.filter((token) => !UNIT_NUMBER.test(token));
    const numbers = name.coreTokens.filter((token) => UNIT_NUMBER.test(token)).sort();
    const variant = { core: words.join(' '), numbers: numbers.join(' ') };
    if (variant.core !== '') variants.set(`${variant.core}#${variant.numbers}`, variant);
  }
  return {
    features,
    variants: [...variants.values()],
    typeWords: [...new Set(normalized.flatMap((name) => name.typeWords))],
    blockingTokens: new Set(
      [...variants.values()].flatMap((variant) =>
        variant.core.split(' ').filter((token) => token.length >= 3),
      ),
    ),
  };
}

function typeCompatibility(
  left: MatchFeatures,
  right: MatchFeatures,
): 'compatible' | 'incompatible' | 'unknown' {
  const types = [left.structureType, right.structureType];
  const osm = types.find((type) => type?.startsWith('osm:') === true);
  const register = types.find((type) => type?.startsWith('situr:') === true);
  if (osm === undefined || register === undefined || osm === null || register === null) {
    return left.structureType !== null && left.structureType === right.structureType
      ? 'compatible'
      : 'unknown';
  }
  const registerType = register.slice('situr:'.length);
  return (COMPATIBLE_TYPES[osm] ?? []).includes(registerType) ? 'compatible' : 'incompatible';
}

function typeWordConflict(left: PreparedCandidate, right: PreparedCandidate): boolean {
  const groups = (words: string[]) =>
    new Set(words.map((word) => TYPE_WORD_GROUPS[word]).filter((group) => group !== undefined));
  const leftGroups = groups(left.typeWords);
  const rightGroups = groups(right.typeWords);
  if (leftGroups.size === 0 || rightGroups.size === 0) return false;
  return ![...leftGroups].some((group) => rightGroups.has(group));
}

interface GeoAgreement {
  agrees: boolean;
  basis: 'same_site' | 'settlement' | 'county_only' | 'different_county' | 'unknown';
  detail: JsonObject;
}

function geoAgreement(
  left: MatchFeatures,
  right: MatchFeatures,
  bothRegister: boolean,
): GeoAgreement {
  if (
    left.countyCode !== null &&
    right.countyCode !== null &&
    left.countyCode !== right.countyCode
  ) {
    return { agrees: false, basis: 'different_county', detail: {} };
  }
  if (left.point !== null && right.point !== null) {
    const distance = Math.round(distanceKm(left.point, right.point) * 1000) / 1000;
    if (distance <= SAME_SITE_DISTANCE_KM) {
      return { agrees: true, basis: 'same_site', detail: { distanceKm: distance } };
    }
  }

  if (bothRegister) {
    // Register rows state their settlement exactly; sharing only the commune is not enough.
    if (
      left.primarySettlementKey !== null &&
      left.primarySettlementKey === right.primarySettlementKey
    ) {
      return {
        agrees: true,
        basis: 'settlement',
        detail: { settlement: left.primarySettlementKey, via: 'stated' },
      };
    }
  } else {
    const statedLeft = new Set(left.settlementKeys);
    const sharedStated = right.settlementKeys.find((key) => statedLeft.has(key));
    if (sharedStated !== undefined) {
      return {
        agrees: true,
        basis: 'settlement',
        detail: { settlement: sharedStated, via: 'stated' },
      };
    }
    for (const [stated, nearby] of [
      [left, right],
      [right, left],
    ] as const) {
      const near = nearby.nearbySettlements.find((place) =>
        stated.settlementKeys.includes(place.key),
      );
      if (near !== undefined) {
        return {
          agrees: true,
          basis: 'settlement',
          detail: { settlement: near.name, via: 'nearby_place', distanceKm: near.distanceKm },
        };
      }
    }
  }
  if (left.countyCode !== null && left.countyCode === right.countyCode) {
    return { agrees: false, basis: 'county_only', detail: {} };
  }
  return { agrees: false, basis: 'unknown', detail: {} };
}

export interface NameFrequencies {
  county: ReadonlyMap<string, number>;
  national: ReadonlyMap<string, number>;
}

export function comparePair(
  left: PreparedCandidate,
  right: PreparedCandidate,
  frequencies: NameFrequencies,
  broadIdentifiers: ReadonlySet<string> = new Set(),
): DuplicateSuggestionDraft[] {
  const a = left.features;
  const b = right.features;
  const bothRegister =
    a.sourceKey === 'situr_accommodation_register' &&
    b.sourceKey === 'situr_accommodation_register';
  const geo = geoAgreement(a, b, bothRegister);

  let nameSimilarity = 0;
  let exactCore: string | null = null;
  let sameCoreDifferentNumbers = false;
  for (const leftVariant of left.variants) {
    for (const rightVariant of right.variants) {
      const similarity = trigramSimilarity(leftVariant.core, rightVariant.core);
      if (leftVariant.core === rightVariant.core) {
        if (leftVariant.numbers === rightVariant.numbers) exactCore = leftVariant.core;
        else sameCoreDifferentNumbers = true;
      }
      if (leftVariant.numbers === rightVariant.numbers) {
        nameSimilarity = Math.max(nameSimilarity, similarity);
      } else if (similarity >= 0.8) {
        sameCoreDifferentNumbers = true;
      }
    }
  }
  nameSimilarity = Math.round(nameSimilarity * 1000) / 1000;
  const unitNumberConflict = exactCore === null && sameCoreDifferentNumbers;

  const county = a.countyCode ?? b.countyCode ?? '';
  const countyFrequency =
    exactCore === null ? 0 : (frequencies.county.get(`${county}|${exactCore}`) ?? 0);
  const nationalFrequency = exactCore === null ? 0 : (frequencies.national.get(exactCore) ?? 0);
  const placeKeys = new Set([
    ...a.settlementKeys,
    ...b.settlementKeys,
    ...a.nearbySettlements.map((place) => place.key),
    ...b.nearbySettlements.map((place) => place.key),
  ]);
  const coreIsPlaceName = exactCore !== null && placeKeys.has(exactCore);
  const commonName =
    countyFrequency > COUNTY_COMMON_NAME_THRESHOLD ||
    nationalFrequency > NATIONAL_COMMON_NAME_THRESHOLD;
  const shortName = exactCore !== null && exactCore.length < MIN_INFORMATIVE_CORE_LENGTH;
  const weakName = commonName || coreIsPlaceName || shortName;

  const sameStreet = a.streetKey !== null && a.streetKey === b.streetKey;
  const bothNumbers = a.houseNumberKey !== null && b.houseNumberKey !== null;
  const address =
    sameStreet && bothNumbers
      ? a.houseNumberKey === b.houseNumberKey
        ? 'match'
        : 'conflict'
      : a.streetKey !== null && b.streetKey !== null && !sameStreet
        ? 'different_street'
        : 'unknown';
  const leftSites = new Map(a.websites.map((site) => [site.identityKey, site]));
  const sharedSite = b.websites.find(
    (site) => leftSites.has(site.identityKey) && !broadIdentifiers.has(`site:${site.identityKey}`),
  );
  const sharedPlatformPage = sharedSite?.platform === true;
  const sharedOwnDomain = sharedSite !== undefined && !sharedSite.platform;
  const sharedEmailDomain =
    a.emailDomain !== null &&
    a.emailDomain === b.emailDomain &&
    !broadIdentifiers.has(`email:${a.emailDomain}`);
  const sharedTaxId =
    a.taxId !== null && a.taxId === b.taxId && !broadIdentifiers.has(`tax:${a.taxId}`);
  const sameCertificate =
    bothRegister && a.certificateNumber !== null && a.certificateNumber === b.certificateNumber;
  const capacityDiffers =
    a.sleepsPersons !== null && b.sleepsPersons !== null && a.sleepsPersons !== b.sleepsPersons;
  const types = typeCompatibility(a, b);
  const wordConflict = typeWordConflict(left, right);

  const contradictions = [
    address === 'conflict' ? 'house_number_conflict' : null,
    address === 'different_street' ? 'different_street' : null,
    types === 'incompatible' ? 'incompatible_structure_types' : null,
    wordConflict ? 'conflicting_type_words' : null,
    unitNumberConflict ? 'different_unit_numbers' : null,
    geo.basis === 'different_county' ? 'different_county' : null,
  ].filter((value) => value !== null);
  const contradicted = contradictions.length > 0;

  const signals: JsonObject = {
    geo: { basis: geo.basis, ...geo.detail },
    nameSimilarity,
    exactCoreName: exactCore,
    coreNameCandidatesInCounty: countyFrequency,
    coreNameCandidatesNationally: nationalFrequency,
    weakName: { common: commonName, placeName: coreIsPlaceName, short: shortName },
    unitNumberConflict,
    typeWordConflict: wordConflict,
    structureTypes: { left: a.structureType, right: b.structureType, compatibility: types },
    address,
    sharedWebsite: sharedSite?.identityKey ?? null,
    sharedWebsiteIsPlatformPage: sharedPlatformPage,
    sharedEmailDomain: sharedEmailDomain ? a.emailDomain : null,
    sharedTaxId,
    sameCertificateNumber: sameCertificate,
    capacityDiffers,
    contradictions,
    sources: `${a.sourceKey}~${b.sourceKey}`,
  };

  let strength: MatchStrength | null = null;
  let rule: string | null = null;
  if (geo.agrees && bothRegister) {
    // Same-name register rows in one settlement are often sibling units of one
    // operator; only a shared certificate or an identical address and capacity
    // indicates a duplicate entry.
    if (exactCore !== null && sameCertificate && !contradicted) {
      [strength, rule] = ['likely', 'same_certificate_and_name'];
    } else if (exactCore !== null && address === 'match' && !capacityDiffers && !contradicted) {
      [strength, rule] = ['likely', 'same_name_address_capacity'];
    } else if (exactCore !== null && !contradicted) {
      [strength, rule] = ['possible', 'same_name_same_settlement'];
    } else if (nameSimilarity >= REGISTER_NAME_SIMILARITY_POSSIBLE && !contradicted) {
      [strength, rule] = ['possible', 'near_identical_name_same_settlement'];
    }
  } else if (geo.agrees) {
    if (exactCore !== null && !weakName && !contradicted) {
      [strength, rule] = ['likely', 'exact_core_name_same_settlement'];
    } else if (
      address === 'match' &&
      nameSimilarity >= NAME_SIMILARITY_WITH_ADDRESS &&
      !contradicted
    ) {
      [strength, rule] = ['likely', 'address_match_similar_name'];
    } else if (sharedPlatformPage && !contradicted) {
      [strength, rule] = ['likely', 'same_listing_page'];
    } else if (exactCore !== null && !unitNumberConflict) {
      [strength, rule] = ['possible', 'exact_core_name_with_caveats'];
    } else if (
      nameSimilarity >= NAME_SIMILARITY_POSSIBLE &&
      !unitNumberConflict &&
      address !== 'conflict'
    ) {
      [strength, rule] = ['possible', 'similar_name_same_settlement'];
    }
  }

  if (strength !== null && rule !== null) {
    return [
      {
        leftCandidateId: a.candidateId,
        rightCandidateId: b.candidateId,
        relation: 'same_property',
        strength,
        score:
          Math.round((nameSimilarity * 0.7 + (geo.basis === 'same_site' ? 0.3 : 0.2)) * 1000) /
          1000,
        signals: { ...signals, decisionRules: [rule] },
      },
    ];
  }
  if (
    !bothRegister &&
    (sharedTaxId || sharedOwnDomain || sharedEmailDomain || sharedPlatformPage)
  ) {
    // Operator-level evidence: one Provider may run several properties. Register
    // rows already name their operator, so register pairs are grouped by
    // identifier in the quality report instead of pairwise suggestions.
    const providerRule = sharedTaxId
      ? 'shared_tax_id'
      : sharedPlatformPage
        ? 'shared_listing_page'
        : sharedOwnDomain
          ? 'shared_website_domain'
          : 'shared_email_domain';
    return [
      {
        leftCandidateId: a.candidateId,
        rightCandidateId: b.candidateId,
        relation: 'same_provider',
        strength: sharedTaxId ? 'likely' : 'possible',
        score: sharedTaxId ? 1 : 0.5,
        signals: { ...signals, decisionRules: [providerRule] },
      },
    ];
  }
  return [];
}

/** Deterministic order so each unordered pair has one left/right orientation. */
function orderKey(features: MatchFeatures): string {
  return `${features.sourceKey}|${features.sourceRecordKey}`;
}

export interface MatcherRun {
  suggestions: DuplicateSuggestionDraft[];
  pairsCompared: number;
  broadIdentifiers: string[];
}

export function generateDuplicateSuggestions(all: MatchFeatures[]): MatcherRun {
  const prepared = all
    .map(prepareCandidate)
    .sort((left, right) => (orderKey(left.features) < orderKey(right.features) ? -1 : 1));
  const index = new Map(prepared.map((item, position) => [item.features.candidateId, position]));

  const county = new Map<string, number>();
  const national = new Map<string, number>();
  for (const item of prepared) {
    for (const core of new Set(item.variants.map((variant) => variant.core))) {
      const key = `${item.features.countyCode ?? ''}|${core}`;
      county.set(key, (county.get(key) ?? 0) + 1);
      national.set(core, (national.get(core) ?? 0) + 1);
    }
  }

  // Candidate generation: blocks keyed by county + name, exact identifiers,
  // address, and spatial cells. Each pair is compared once.
  const blocks = new Map<string, number[]>();
  const addToBlock = (key: string, position: number) => {
    const block = blocks.get(key) ?? [];
    if (block.at(-1) !== position) block.push(position);
    blocks.set(key, block);
  };
  prepared.forEach((item, position) => {
    const { features } = item;
    const countyKey = features.countyCode ?? '?';
    for (const variant of item.variants) addToBlock(`core:${countyKey}:${variant.core}`, position);
    for (const token of item.blockingTokens) addToBlock(`token:${countyKey}:${token}`, position);
    for (const site of features.websites) addToBlock(`site:${site.identityKey}`, position);
    if (features.emailDomain !== null) addToBlock(`email:${features.emailDomain}`, position);
    if (features.taxId !== null) addToBlock(`tax:${features.taxId}`, position);
    if (features.streetKey !== null && features.houseNumberKey !== null) {
      addToBlock(`address:${countyKey}:${features.streetKey}:${features.houseNumberKey}`, position);
    }
    if (features.point !== null) {
      const cellX = Math.floor(features.point[0] / 0.005);
      const cellY = Math.floor(features.point[1] / 0.005);
      for (let dx = 0; dx <= 1; dx += 1) {
        for (let dy = 0; dy <= 1; dy += 1) {
          addToBlock(`cell:${String(cellX - dx)}:${String(cellY - dy)}`, position);
        }
      }
    }
  });

  const broadIdentifiers = new Set<string>();
  for (const [key, members] of blocks) {
    if (/^(site|email|tax):/.test(key) && members.length > BROAD_IDENTIFIER_THRESHOLD) {
      broadIdentifiers.add(key);
    }
  }

  const pairs = new Set<number>();
  const total = prepared.length;
  for (const [key, members] of blocks) {
    if (members.length < 2 || broadIdentifiers.has(key)) continue;
    if (key.startsWith('token:') && members.length > MAX_TOKEN_BLOCK) continue;
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const left = Math.min(members[i] ?? 0, members[j] ?? 0);
        const right = Math.max(members[i] ?? 0, members[j] ?? 0);
        if (left !== right) pairs.add(left * total + right);
      }
    }
  }

  const drafts: DuplicateSuggestionDraft[] = [];
  for (const pair of [...pairs].sort((x, y) => x - y)) {
    const left = prepared[Math.floor(pair / total)];
    const right = prepared[pair % total];
    if (left === undefined || right === undefined) continue;
    drafts.push(...comparePair(left, right, { county, national }, broadIdentifiers));
  }

  return {
    suggestions: resolveAmbiguity(drafts, prepared, index),
    pairsCompared: pairs.size,
    broadIdentifiers: [...broadIdentifiers].sort(),
  };
}

/**
 * A Candidate with several `likely` same-property counterparts from another
 * source cannot be resolved automatically (a complex, sibling units, or a
 * generic name): all of those suggestions are downgraded to `possible`.
 */
function resolveAmbiguity(
  drafts: DuplicateSuggestionDraft[],
  prepared: PreparedCandidate[],
  index: ReadonlyMap<string, number>,
): DuplicateSuggestionDraft[] {
  const sourceOf = (id: string) => prepared[index.get(id) ?? -1]?.features.sourceKey;
  const crossSource = (draft: DuplicateSuggestionDraft) =>
    sourceOf(draft.leftCandidateId) !== sourceOf(draft.rightCandidateId);
  const likelyCounterparts = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.relation !== 'same_property' || draft.strength !== 'likely' || !crossSource(draft))
      continue;
    for (const id of [draft.leftCandidateId, draft.rightCandidateId]) {
      likelyCounterparts.set(id, (likelyCounterparts.get(id) ?? 0) + 1);
    }
  }
  return drafts.map((draft) => {
    const ambiguous =
      (likelyCounterparts.get(draft.leftCandidateId) ?? 0) > 1 ||
      (likelyCounterparts.get(draft.rightCandidateId) ?? 0) > 1;
    if (
      draft.relation !== 'same_property' ||
      draft.strength !== 'likely' ||
      !crossSource(draft) ||
      !ambiguous
    ) {
      return draft;
    }
    const rules = Array.isArray(draft.signals.decisionRules) ? draft.signals.decisionRules : [];
    return {
      ...draft,
      strength: 'possible',
      signals: { ...draft.signals, decisionRules: [...rules, 'downgraded_multiple_counterparts'] },
    };
  });
}
