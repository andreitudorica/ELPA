import { screenGroupRentalProperty, SCREENING_POLICY_ID } from './population-screening';
import {
  countyCodeFromName,
  parseRegisterAddress,
  parseRegisterLocality,
} from './romania-geography';
import {
  ArtifactFormatError,
  canonicalJson,
  type JsonObject,
  type ProposedClaim,
  type RecordError,
  sha256Hex,
  type SourceArtifactReading,
  type SourceRecord,
} from './source-record';
import { cleanDisplayText, foldText, normalizePropertyName } from './text-normalization';
import { businessEmailDomain, normalizeWebsite } from './web-identity';
import { readFirstWorksheet, XlsxFormatError } from './xlsx-reader';

/**
 * Adapter for the Romanian official register of classified tourist
 * accommodation structures (Direcția Generală de Turism, SITUR open data,
 * export `listaCazari`). One row is one classification certificate, not
 * necessarily one property: a complex can hold several certificates and
 * certificate numbers are reused. The register has no stable row identifier,
 * so the adapter derives one from identity-bearing fields.
 */
export const SITUR_SOURCE_KEY = 'situr_accommodation_register';
export const SITUR_PARSER_VERSION = 'situr-accommodation-xlsx@1';
export const SITUR_NORMALIZER_VERSION = 'situr-accommodation-normalizer@1';

export const SITUR_HEADERS = [
  'Tip unitate',
  'Nume unitate',
  'Tip categorie',
  'Număr spații',
  'Număr locuri',
  'Alte detalii adresă',
  'Tip localitate',
  'Localitate componentă',
  'Localitate',
  'Județ',
  'Email',
  'Web',
  'Tip Operator Economic',
  'Operator Economic',
  'Număr Înregistrare',
  'Cod Unic Înregistrare',
  'Număr autorizație',
  'Dată emitere autorizație',
] as const;

type SiturField = (typeof SITUR_HEADERS)[number];
type SiturRow = Record<SiturField, string | null>;

export const SITUR_STRUCTURE_TYPES = new Set([
  'apartamente_de_inchiriat',
  'bungalouri',
  'cabana_turistica',
  'camere_de_inchiriat',
  'camping',
  'casute_tip_camping',
  'hostel',
  'hotel',
  'hotel_apartament',
  'motel',
  'nava_fluviala',
  'nava_maritima',
  'pensiune_agroturistica',
  'pensiune_turistica',
  'ponton_plutitor',
  'popas_turistic',
  'sat_de_vacanta',
  'spatii_de_campare',
  'vila_turistica',
]);

/** Operator types that identify a legal entity rather than a natural person. */
const LEGAL_ENTITY_OPERATOR_TYPES = new Map<string, string>([
  ['societate comerciala s r l s a etc', 'company'],
  ['societate comerciala', 'company'],
  ['asociatie', 'association'],
  ['ong', 'association'],
  ['institutie publica', 'public_institution'],
  ['primarie', 'public_institution'],
  ['cult', 'religious_entity'],
  ['institutie de cult', 'religious_entity'],
]);
const SOLE_TRADER_OPERATOR_TYPE = 'pfa intreprinedre individuala sau familiala';

/** Fields withheld from storage for every record (data minimisation). */
const ALWAYS_REDACTED: SiturField[] = ['Email'];
/** Fields withheld when the operator may be a natural person. */
const NATURAL_PERSON_REDACTED: SiturField[] = [
  'Operator Economic',
  'Număr Înregistrare',
  'Cod Unic Înregistrare',
];

const TITLE_PATTERN = /ACTUALIZAT[ĂA]\s+LA\s+(\d{2})\.(\d{2})\.(\d{4})/iu;

export function readSiturAccommodationArtifact(workbook: Uint8Array): SourceArtifactReading {
  let rows;
  try {
    rows = readFirstWorksheet(workbook);
  } catch (error) {
    if (error instanceof XlsxFormatError) {
      throw new ArtifactFormatError('situr.unreadable_workbook', error.message);
    }
    throw error;
  }

  const title = rows[0]?.[0]?.trim() ?? '';
  const titleMatch = TITLE_PATTERN.exec(title);
  if (titleMatch === null) {
    throw new ArtifactFormatError(
      'situr.missing_version_title',
      'The first row does not state the register update date',
    );
  }
  const [, day, month, year] = titleMatch;
  const datasetVersion = `${year ?? ''}-${month ?? ''}-${day ?? ''}`;
  const observedAt = new Date(`${datasetVersion}T00:00:00.000Z`);
  if (Number.isNaN(observedAt.getTime())) {
    throw new ArtifactFormatError('situr.invalid_version_date', `Invalid update date ${title}`);
  }

  const header = (rows[1] ?? []).map((cell) => cell?.normalize('NFC').trim() ?? '');
  const expected = SITUR_HEADERS.map((name) => name.normalize('NFC'));
  if (header.length < expected.length || expected.some((name, index) => header[index] !== name)) {
    throw new ArtifactFormatError(
      'situr.unexpected_columns',
      `Unexpected register columns: ${header.join(' | ')}`,
    );
  }

  const parsedRows: { position: number; row: SiturRow }[] = [];
  rows.slice(2).forEach((cells, index) => {
    if (cells.every((cell) => cell === null || cell.trim() === '')) return;
    const row = Object.fromEntries(
      SITUR_HEADERS.map((name, column) => [name, cells[column] ?? null]),
    ) as SiturRow;
    parsedRows.push({ position: index + 3, row });
  });

  const records = assignRecordKeys(parsedRows.map(({ position, row }) => toRecord(position, row)));

  return {
    sourceKey: SITUR_SOURCE_KEY,
    datasetVersion,
    observedAt,
    parserVersion: SITUR_PARSER_VERSION,
    normalizerVersion: SITUR_NORMALIZER_VERSION,
    metadata: { title, columns: header },
    records,
    excluded: {},
  };
}

interface KeyedDraft {
  identity: string;
  record: SourceRecord;
}

function toRecord(position: number, row: SiturRow): KeyedDraft {
  const errors: RecordError[] = [];
  const name = cleanDisplayText(row['Nume unitate']);
  const structureLabel = cleanDisplayText(row['Tip unitate']);
  const structureType =
    structureLabel === null ? null : foldText(structureLabel).replace(/ /g, '_');
  const countyCode = countyCodeFromName(row['Județ']);
  const locality = parseRegisterLocality(row.Localitate);
  const certificateNumber = cleanDisplayText(row['Număr autorizație']);
  const certificateDate = parseRegisterDate(row['Dată emitere autorizație']);

  if (name === null) {
    errors.push({ code: 'missing_name', message: 'Nume unitate is empty', field: 'Nume unitate' });
  }
  if (structureType === null || !SITUR_STRUCTURE_TYPES.has(structureType)) {
    errors.push({
      code: 'unknown_structure_type',
      message: `Unrecognised structure type ${structureLabel ?? '(empty)'}`,
      field: 'Tip unitate',
    });
  }
  if (countyCode === null) {
    errors.push({
      code: 'unknown_county',
      message: `Unrecognised county ${row['Județ'] ?? '(empty)'}`,
      field: 'Județ',
    });
  }

  const operatorType = foldText(row['Tip Operator Economic'] ?? '');
  const legalEntityKind = LEGAL_ENTITY_OPERATOR_TYPES.get(operatorType);
  const redactedFields = [
    ...ALWAYS_REDACTED,
    ...(legalEntityKind === undefined ? NATURAL_PERSON_REDACTED : []),
  ];

  const identity = canonicalJson({
    certificate: certificateNumber,
    issuedOn: certificateDate,
    structureType,
    name: foldText(name ?? ''),
    county: countyCode ?? foldText(row['Județ'] ?? ''),
    locality: foldText(row.Localitate ?? ''),
  });

  const record: SourceRecord = {
    sourceRecordKey: '',
    sourceRecordUrl: null,
    position,
    rawPayload: row,
    redactedFields: [...redactedFields],
    status: errors.length === 0 ? 'parsed' : 'rejected',
    errors,
    claims: [],
    summary: null,
    scopeSettlements: [locality.settlement?.name, locality.uat?.name].filter(
      (value): value is string => value !== undefined,
    ),
  };

  if (record.status === 'parsed' && name !== null && structureType !== null) {
    const normalizedName = normalizePropertyName(name);
    const address = parseRegisterAddress(row['Alte detalii adresă']);
    const sleepsPersons = parseCount(row['Număr locuri']);
    const screening = screenGroupRentalProperty({
      structureType,
      sleepsPersons,
      urbanity: locality.urbanity,
      nameTypeWords: normalizedName.typeWords,
      apartmentBuilding: address?.apartmentBuilding ?? false,
    });

    const claims: ProposedClaim[] = [];
    const add = (target: string, value: ProposedClaim['value'], fields: SiturField[]) => {
      if (value === null) return;
      claims.push({
        target,
        value,
        locator: { type: 'structured_field', fields },
        confidence: 0.95,
      });
    };

    add('offer.name', name, ['Nume unitate']);
    add('offer.registry_structure_type', { key: structureType, label: structureLabel }, [
      'Tip unitate',
    ]);
    add('offer.registry_classification', parseClassification(row['Tip categorie']), [
      'Tip categorie',
    ]);
    add('offer.units_count', parseCount(row['Număr spații']), ['Număr spații']);
    add('offer.sleeps_persons', sleepsPersons, ['Număr locuri']);
    add(
      'offer.primary_locality',
      {
        countyCode,
        countyName: cleanDisplayText(row['Județ']),
        uatName: locality.uat?.name ?? null,
        uatKind: locality.uat?.kind ?? null,
        settlementName: locality.settlement?.name ?? null,
        settlementKind: locality.settlement?.kind ?? null,
        sector: locality.sector,
        urbanity: locality.urbanity,
      },
      ['Localitate', 'Județ', 'Tip localitate', 'Localitate componentă'],
    );
    if (address !== null) {
      add(
        'offer.address',
        {
          street: address.street,
          streetKey: address.streetKey,
          houseNumber: address.houseNumber,
          houseNumberKey: address.houseNumberKey,
          apartmentBuilding: address.apartmentBuilding,
          raw: address.raw,
        },
        ['Alte detalii adresă'],
      );
    }
    const website = normalizeWebsite(row.Web);
    if (website !== null) add('offer.website', [{ ...website }], ['Web']);
    add('offer.business_email_domain', businessEmailDomain(row.Email), ['Email']);
    if (certificateNumber !== null || certificateDate !== null) {
      add('offer.registry_certificate', { number: certificateNumber, issuedOn: certificateDate }, [
        'Număr autorizație',
        'Dată emitere autorizație',
      ]);
    }

    add(
      'provider_hint.kind',
      legalEntityKind ??
        (operatorType === SOLE_TRADER_OPERATOR_TYPE
          ? 'sole_trader_or_family_business'
          : 'unspecified'),
      ['Tip Operator Economic'],
    );
    if (legalEntityKind !== undefined) {
      add('provider_hint.legal_name', cleanDisplayText(row['Operator Economic']), [
        'Operator Economic',
      ]);
      add('provider_hint.tax_id', parseTaxId(row['Cod Unic Înregistrare']), [
        'Cod Unic Înregistrare',
      ]);
      add('provider_hint.trade_register_number', cleanDisplayText(row['Număr Înregistrare']), [
        'Număr Înregistrare',
      ]);
    }

    claims.push({
      target: 'offer.population_screening',
      value: { class: screening.screeningClass, reasons: screening.reasons },
      locator: {
        type: 'inferred',
        policyId: SCREENING_POLICY_ID,
        rationale: screening.reasons.join(', '),
        inputs: {
          structureType,
          sleepsPersons,
          urbanity: locality.urbanity,
          nameTypeWords: normalizedName.typeWords,
          apartmentBuilding: address?.apartmentBuilding ?? false,
        },
      },
      confidence: SCREENING_CONFIDENCE[screening.screeningClass],
      extractionMethod: SCREENING_POLICY_ID,
    });

    record.claims = claims;
    record.summary = {
      displayName: name,
      countyCode,
      settlementName: locality.settlement?.name ?? null,
      screeningClass: screening.screeningClass,
    };
  }

  return { identity, record };
}

/** Heuristic, uncalibrated confidence per screening class (rubric v1). */
export const SCREENING_CONFIDENCE = {
  plausible: 0.5,
  ambiguous: 0.3,
  out_of_scope: 0.7,
  insufficient_data: 0.1,
} as const;

/**
 * Keys are `cert:<number>|<issue date>|<identity hash>`. Records whose
 * identity fields are entirely equal are disambiguated with `#n`, ordered by
 * content checksum so the assignment does not depend on row order.
 */
function assignRecordKeys(drafts: KeyedDraft[]): SourceRecord[] {
  const groups = new Map<string, KeyedDraft[]>();
  for (const draft of drafts) {
    const group = groups.get(draft.identity) ?? [];
    group.push(draft);
    groups.set(draft.identity, group);
  }

  for (const [identity, group] of groups) {
    const parsed = JSON.parse(identity) as { certificate: string | null; issuedOn: string | null };
    const base = `cert:${parsed.certificate ?? 'none'}|${parsed.issuedOn ?? 'none'}|${sha256Hex(identity).slice(0, 12)}`;
    const ordered = [...group].sort((left, right) => {
      const leftHash = sha256Hex(canonicalJson(left.record.rawPayload));
      const rightHash = sha256Hex(canonicalJson(right.record.rawPayload));
      return leftHash < rightHash
        ? -1
        : leftHash > rightHash
          ? 1
          : left.record.position - right.record.position;
    });
    ordered.forEach((draft, index) => {
      draft.record.sourceRecordKey = index === 0 ? base : `${base}#${String(index + 1)}`;
    });
  }

  return drafts.map(({ record }) => record);
}

function parseCount(value: string | null): number | null {
  const cleaned = value?.trim() ?? '';
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
}

function parseRegisterDate(value: string | null): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value?.trim() ?? '');
  if (match === null) return null;
  const iso = `${match[3] ?? ''}-${match[2] ?? ''}-${match[1] ?? ''}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
}

function parseClassification(value: string | null): JsonObject | null {
  const match = /^\s*(\d)\s*-\s*(\S+)\s*$/u.exec(value ?? '');
  if (match === null) return null;
  return { level: Number(match[1]), system: foldText(match[2] ?? '') };
}

function parseTaxId(value: string | null): string | null {
  const digits = (value ?? '').replace(/^\s*RO\s*/i, '').trim();
  return /^\d{2,10}$/.test(digits) ? digits : null;
}
