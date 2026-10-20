import {
  cleanDisplayText,
  foldText,
  normalizeHouseNumber,
  normalizeStreetName,
} from './text-normalization';

/**
 * Romanian counties (județe) and Bucharest, keyed by ISO 3166-2 code. The list
 * is fixed by law and is the join key between the official register (which
 * spells county names) and OpenStreetMap (whose county boundaries carry the
 * ISO code).
 */
export const ROMANIAN_COUNTIES = {
  'RO-AB': 'Alba',
  'RO-AR': 'Arad',
  'RO-AG': 'Argeș',
  'RO-BC': 'Bacău',
  'RO-BH': 'Bihor',
  'RO-BN': 'Bistrița-Năsăud',
  'RO-BT': 'Botoșani',
  'RO-BV': 'Brașov',
  'RO-BR': 'Brăila',
  'RO-B': 'București',
  'RO-BZ': 'Buzău',
  'RO-CS': 'Caraș-Severin',
  'RO-CL': 'Călărași',
  'RO-CJ': 'Cluj',
  'RO-CT': 'Constanța',
  'RO-CV': 'Covasna',
  'RO-DB': 'Dâmbovița',
  'RO-DJ': 'Dolj',
  'RO-GL': 'Galați',
  'RO-GR': 'Giurgiu',
  'RO-GJ': 'Gorj',
  'RO-HR': 'Harghita',
  'RO-HD': 'Hunedoara',
  'RO-IL': 'Ialomița',
  'RO-IS': 'Iași',
  'RO-IF': 'Ilfov',
  'RO-MM': 'Maramureș',
  'RO-MH': 'Mehedinți',
  'RO-MS': 'Mureș',
  'RO-NT': 'Neamț',
  'RO-OT': 'Olt',
  'RO-PH': 'Prahova',
  'RO-SM': 'Satu Mare',
  'RO-SJ': 'Sălaj',
  'RO-SB': 'Sibiu',
  'RO-SV': 'Suceava',
  'RO-TR': 'Teleorman',
  'RO-TM': 'Timiș',
  'RO-TL': 'Tulcea',
  'RO-VS': 'Vaslui',
  'RO-VL': 'Vâlcea',
  'RO-VN': 'Vrancea',
} as const;

export type CountyCode = keyof typeof ROMANIAN_COUNTIES;

const COUNTY_BY_FOLDED_NAME = new Map<string, CountyCode>(
  Object.entries(ROMANIAN_COUNTIES).map(([code, name]) => [foldText(name), code as CountyCode]),
);

export function isCountyCode(value: string): value is CountyCode {
  return Object.hasOwn(ROMANIAN_COUNTIES, value);
}

/** Resolves `CONSTANŢA`, `Județul Constanța`, `Municipiul București`, ... */
export function countyCodeFromName(name: string | null | undefined): CountyCode | null {
  if (name === null || name === undefined) return null;
  const folded = foldText(name)
    .replace(/^(judetul|judet|jud)\s+/, '')
    .replace(/^(municipiul|mun)\s+/, '');
  return COUNTY_BY_FOLDED_NAME.get(folded) ?? null;
}

export type SettlementKind = 'municipiu' | 'oras' | 'comuna' | 'sat' | 'localitate' | 'sector';

export interface LocalityComponent {
  kind: SettlementKind | null;
  name: string;
}

export interface ParsedLocality {
  /** Administrative unit (UAT): municipality, town, or commune. */
  uat: LocalityComponent | null;
  /** Most specific settlement named by the source. */
  settlement: LocalityComponent | null;
  sector: string | null;
  urbanity: 'urban' | 'rural' | 'unknown';
}

const LOCALITY_KEYWORD =
  /(?:^|[\s,])(mun\.?|municipiul|ora[sşș]ul|ora[sşș]\.?|com\.?|comuna|satul|sat\.?|loc\.?|localitatea|sectorul|sector\.?)(?=[\s,]|$)/giu;

function settlementKind(keyword: string): SettlementKind {
  const folded = foldText(keyword);
  if (folded.startsWith('mun')) return 'municipiu';
  if (folded.startsWith('oras')) return 'oras';
  if (folded.startsWith('com')) return 'comuna';
  if (folded.startsWith('sat')) return 'sat';
  if (folded.startsWith('sector')) return 'sector';
  return 'localitate';
}

function splitLocalityComponents(raw: string): LocalityComponent[] {
  const matches = [...raw.matchAll(LOCALITY_KEYWORD)];
  if (matches.length === 0) {
    const name = cleanDisplayText(raw.replace(/,/g, ' '));
    return name === null ? [] : [{ kind: null, name }];
  }

  const components: LocalityComponent[] = [];
  const leading = cleanDisplayText(raw.slice(0, matches[0]?.index ?? 0).replace(/,/g, ' '));
  if (leading !== null) components.push({ kind: null, name: leading });
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? raw.length;
    const name = cleanDisplayText(raw.slice(start, end).replace(/,/g, ' '));
    if (name !== null) components.push({ kind: settlementKind(match[1] ?? ''), name });
  });
  return components;
}

/**
 * Parses the register's hierarchical locality, e.g. `Com. Somova, Sat Mineri`,
 * `Mun. Alba Iulia, Loc. Oarda`, `Mun. Bucureşti, Sector 1`, or the
 * unpunctuated `Com Arieseni Sat Galbena`.
 */
export function parseRegisterLocality(raw: string | null | undefined): ParsedLocality {
  const components = splitLocalityComponents(raw ?? '');
  const sectorComponent = components.find((component) => component.kind === 'sector');
  const places = components.filter((component) => component.kind !== 'sector');
  const uat = places[0] ?? null;
  const settlement = places.at(-1) ?? null;

  let urbanity: ParsedLocality['urbanity'] = 'unknown';
  if (settlement?.kind === 'sat' || settlement?.kind === 'comuna') urbanity = 'rural';
  else if (
    settlement !== null &&
    settlement === uat &&
    (settlement.kind === 'municipiu' || settlement.kind === 'oras')
  ) {
    urbanity = 'urban';
  }

  return { uat, settlement, sector: sectorComponent?.name ?? null, urbanity };
}

export interface ParsedRegisterAddress {
  street: string | null;
  streetKey: string | null;
  houseNumber: string | null;
  houseNumberKey: string | null;
  /** True when the address names a block (`BL.`) or apartment (`AP.`). */
  apartmentBuilding: boolean;
  raw: string;
}

/**
 * Parses the register's `Alte detalii adresă`, e.g.
 * `STR. Strada Isaccei , NR. 100` or `NR. 12 , BL. F15 , ET. parter , AP. 2`.
 */
export function parseRegisterAddress(raw: string | null | undefined): ParsedRegisterAddress | null {
  const display = cleanDisplayText(raw);
  if (display === null) return null;

  let street: string | null = null;
  let houseNumber: string | null = null;
  let apartmentBuilding = false;
  for (const segment of display.split(/\s+,\s+/)) {
    const match = /^([A-Za-zĂÂÎȘŞȚŢăâîșşțţ]+)\.\s*(.*)$/.exec(segment.trim());
    if (match === null) continue;
    const key = foldText(match[1] ?? '');
    const value = cleanDisplayText(match[2]);
    if (value === null) continue;
    if (key === 'str') street = value;
    else if (key === 'nr') houseNumber = value;
    else if (key === 'bl' || key === 'ap') apartmentBuilding = true;
  }

  return {
    street,
    streetKey: street === null ? null : normalizeStreetName(street),
    houseNumber,
    houseNumberKey: houseNumber === null ? null : normalizeHouseNumber(houseNumber),
    apartmentBuilding,
    raw: display,
  };
}
