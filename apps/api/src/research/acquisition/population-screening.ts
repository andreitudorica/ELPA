import { HOUSE_LIKE_TYPE_WORDS } from './text-normalization';
import type { ScreeningClass } from './source-record';

/**
 * Automated screening against the Group Rental Property research population
 * (docs/research/group-rental-property-baseline/population-definition.md,
 * rubric v1). Screening is an inferred, explainable hint for prioritising
 * human review. It can never establish that a property is in scope: only a
 * reviewer with evidence of whole-property rental can do that.
 */
export const SCREENING_POLICY_ID = 'grp-population-screening@1';

/** Smallest party the population targets (rubric v1, to be calibrated by review). */
export const MIN_GROUP_SLEEPS = 6;
/** Above this capacity a structure is more likely rented by room or unit. */
export const MAX_SINGLE_PROPERTY_SLEEPS = 40;

export type ScreeningReason =
  | 'structure_type_excluded'
  | 'structure_type_rooms_or_units'
  | 'structure_type_multi_unit_complex'
  | 'structure_type_whole_dwelling'
  | 'capacity_below_group_minimum'
  | 'capacity_above_single_property'
  | 'capacity_unknown'
  | 'apartment_in_block'
  | 'urban_setting'
  | 'rural_setting'
  | 'house_like_name'
  | 'osm_camp_site_with_cabins';

export interface ScreeningInput {
  /** Register structure type key or `osm:<tourism value>`. */
  structureType: string | null;
  sleepsPersons: number | null;
  urbanity: 'urban' | 'rural' | 'unknown';
  nameTypeWords: string[];
  apartmentBuilding: boolean;
  campSiteHasCabins?: boolean;
}

export interface ScreeningResult {
  screeningClass: ScreeningClass;
  reasons: ScreeningReason[];
}

const EXCLUDED_TYPES = new Set([
  'hotel',
  'hotel_apartament',
  'motel',
  'hostel',
  'camping',
  'spatii_de_campare',
  'popas_turistic',
  'ponton_plutitor',
  'nava_fluviala',
  'nava_maritima',
  'osm:hotel',
  'osm:motel',
  'osm:hostel',
  'osm:alpine_hut',
]);

/** Structures usually let by room or apartment; exclusive rental needs evidence. */
const ROOM_OR_UNIT_TYPES = new Set([
  'camere_de_inchiriat',
  'apartamente_de_inchiriat',
  'pensiune_turistica',
  'pensiune_agroturistica',
  'osm:guest_house',
  'osm:apartment',
]);

const MULTI_UNIT_TYPES = new Set([
  'casute_tip_camping',
  'bungalouri',
  'sat_de_vacanta',
  'osm:camp_site',
]);

/** Structures that are themselves one dwelling or lodge. */
const WHOLE_DWELLING_TYPES = new Set(['vila_turistica', 'cabana_turistica', 'osm:chalet']);

const APARTMENT_TYPES = new Set(['apartamente_de_inchiriat', 'osm:apartment']);

export function screenGroupRentalProperty(input: ScreeningInput): ScreeningResult {
  const reasons: ScreeningReason[] = [];
  const type = input.structureType;
  const houseLikeName = input.nameTypeWords.some((word) => HOUSE_LIKE_TYPE_WORDS.has(word));
  if (houseLikeName) reasons.push('house_like_name');
  if (input.urbanity === 'urban') reasons.push('urban_setting');
  if (input.urbanity === 'rural') reasons.push('rural_setting');

  if (type === null) return { screeningClass: 'insufficient_data', reasons };

  if (type === 'osm:camp_site' && input.campSiteHasCabins !== true) {
    return { screeningClass: 'out_of_scope', reasons: [...reasons, 'structure_type_excluded'] };
  }
  if (EXCLUDED_TYPES.has(type)) {
    return { screeningClass: 'out_of_scope', reasons: [...reasons, 'structure_type_excluded'] };
  }
  if (input.apartmentBuilding) {
    return { screeningClass: 'out_of_scope', reasons: [...reasons, 'apartment_in_block'] };
  }
  if (input.sleepsPersons !== null && input.sleepsPersons < MIN_GROUP_SLEEPS) {
    return {
      screeningClass: 'out_of_scope',
      reasons: [...reasons, 'capacity_below_group_minimum'],
    };
  }
  if (APARTMENT_TYPES.has(type) && input.urbanity === 'urban') {
    return {
      screeningClass: 'out_of_scope',
      reasons: [...reasons, 'structure_type_rooms_or_units'],
    };
  }
  if (type === 'camere_de_inchiriat' && input.urbanity === 'urban' && !houseLikeName) {
    return {
      screeningClass: 'out_of_scope',
      reasons: [...reasons, 'structure_type_rooms_or_units'],
    };
  }

  if (input.sleepsPersons === null) reasons.push('capacity_unknown');
  const oversized =
    input.sleepsPersons !== null && input.sleepsPersons > MAX_SINGLE_PROPERTY_SLEEPS;
  if (oversized) reasons.push('capacity_above_single_property');

  if (MULTI_UNIT_TYPES.has(type)) {
    if (type === 'osm:camp_site') reasons.push('osm_camp_site_with_cabins');
    return {
      screeningClass: 'ambiguous',
      reasons: [...reasons, 'structure_type_multi_unit_complex'],
    };
  }

  const wholeDwellingType = WHOLE_DWELLING_TYPES.has(type);
  if (wholeDwellingType) reasons.push('structure_type_whole_dwelling');
  if (ROOM_OR_UNIT_TYPES.has(type)) reasons.push('structure_type_rooms_or_units');

  const nonUrban = input.urbanity !== 'urban';
  if (nonUrban && !oversized && (wholeDwellingType || houseLikeName)) {
    return { screeningClass: 'plausible', reasons };
  }
  if (wholeDwellingType || ROOM_OR_UNIT_TYPES.has(type)) {
    return { screeningClass: 'ambiguous', reasons };
  }
  return { screeningClass: 'insufficient_data', reasons };
}
