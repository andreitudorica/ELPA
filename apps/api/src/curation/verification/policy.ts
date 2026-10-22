import { POLICY_VERSION, type CategoryId, type VerificationMethod } from './contracts';

export interface Gate {
  /** Holdout items the policy would approve; fewer cannot bound the error rate. */
  minAccepted: number;
  /** Observed false-approval share among those items. */
  maxFalseApprovalPoint: number;
  /** One-sided 95 % Clopper–Pearson upper bound on that share. */
  maxFalseApprovalUpper: number;
  /** Raw agreement of double-reviewed holdout items before adjudication. */
  minAgreement: number;
  minReviewers: number;
}

export interface CategoryDefinition {
  id: CategoryId;
  risk: 'lower' | 'moderate' | 'higher';
  proposition: string;
  intendedUse: string;
  evidenceRequirements: string[];
  /** `never` means no evaluation result can make the category autonomous. */
  autonomy: 'gated' | 'never';
  corroboration: 'not_required' | 'independent_required';
  /** Whether a semantic assessment is needed, merely informative, or pointless. */
  assessor: 'not_required' | 'advisory' | 'required';
  /** Verification methods a later Publication could accept for this category. */
  publicationMethods: VerificationMethod[];
  freshnessDays: number;
  gate: Gate | null;
}

const LOWER_RISK_GATE: Gate = {
  minAccepted: 100,
  maxFalseApprovalPoint: 0.02,
  maxFalseApprovalUpper: 0.05,
  minAgreement: 0.9,
  minReviewers: 2,
};
const MODERATE_RISK_GATE: Gate = {
  minAccepted: 150,
  maxFalseApprovalPoint: 0.01,
  maxFalseApprovalUpper: 0.02,
  minAgreement: 0.9,
  minReviewers: 2,
};

export const CATEGORIES: Record<CategoryId, CategoryDefinition> = {
  register_locality: {
    id: 'register_locality',
    risk: 'lower',
    proposition: 'County and locality recorded for a classified unit in the official register',
    intendedUse: 'Geographic filtering by county and locality',
    evidenceRequirements: [
      'Explicit structured register fields (Județ, Localitate) in the latest register version',
      'Valid ISO county code and a named settlement',
      'No conflicting current locality Claim on the same Candidate',
    ],
    autonomy: 'gated',
    corroboration: 'not_required',
    assessor: 'not_required',
    publicationMethods: ['machine_policy', 'administrator'],
    freshnessDays: 365,
    gate: LOWER_RISK_GATE,
  },
  osm_county: {
    id: 'osm_county',
    risk: 'lower',
    proposition: 'County containing an OpenStreetMap object, from boundary containment',
    intendedUse: 'County-level geographic filtering; the inferred settlement is never verified',
    evidenceRequirements: [
      'Versioned boundary-containment inference with a recorded county boundary',
      'No conflicting county from an equal or more authoritative counterpart',
    ],
    autonomy: 'gated',
    corroboration: 'not_required',
    assessor: 'not_required',
    publicationMethods: ['machine_policy', 'administrator'],
    freshnessDays: 365,
    gate: LOWER_RISK_GATE,
  },
  register_classified_capacity: {
    id: 'register_classified_capacity',
    risk: 'lower',
    proposition: 'Officially classified accommodation places (register "Număr locuri")',
    intendedUse:
      'Display as official classified places; never as maximum group size or event capacity',
    evidenceRequirements: [
      'Explicit register field Număr locuri in the latest register version',
      'Positive integer within a plausible bound',
    ],
    autonomy: 'gated',
    corroboration: 'not_required',
    assessor: 'not_required',
    publicationMethods: ['machine_policy', 'administrator'],
    freshnessDays: 365,
    gate: LOWER_RISK_GATE,
  },
  explicit_text_facility: {
    id: 'explicit_text_facility',
    risk: 'moderate',
    proposition: 'Explicitly described on-property facility (barbecue, lawn, sauna, hot tub…)',
    intendedUse: 'Must-have matching in the Event Brief',
    evidenceRequirements: [
      'Technically grounded exact passage from the current extraction method',
      'No negation, seasonal or temporal qualifier, approximation or ambiguity',
      'Semantic assessment that the passage states the facility for this property',
    ],
    autonomy: 'gated',
    corroboration: 'not_required',
    assessor: 'required',
    publicationMethods: ['machine_policy', 'administrator'],
    freshnessDays: 365,
    gate: MODERATE_RISK_GATE,
  },
  property_shape_count: {
    id: 'property_shape_count',
    risk: 'moderate',
    proposition: 'Beds, rooms, bedrooms or bathrooms stated by a source',
    intendedUse: 'Property-shape display and filtering',
    evidenceRequirements: [
      'Explicit source statement with a known count definition',
      'Independent corroboration: crowd-sourced counts carry no edit date',
    ],
    autonomy: 'gated',
    corroboration: 'independent_required',
    assessor: 'advisory',
    publicationMethods: ['machine_policy', 'administrator'],
    freshnessDays: 365,
    gate: MODERATE_RISK_GATE,
  },
  high_consequence: {
    id: 'high_consequence',
    risk: 'higher',
    proposition:
      'Guest or event capacity, whole-property rental, private-event permission, pool availability or noise rules',
    intendedUse: 'Eligibility and suitability decisions a User relies on',
    evidenceRequirements: [
      'Administrator verification of explicit Evidence, or a recent owner confirmation',
      'Silence never establishes permission, exclusivity or availability',
    ],
    autonomy: 'never',
    corroboration: 'independent_required',
    assessor: 'advisory',
    publicationMethods: ['administrator', 'owner_confirmation'],
    freshnessDays: 180,
    gate: null,
  },
};

const HIGH_CONSEQUENCE = new Set([
  'sleeps_persons',
  'capacity_persons',
  'max_daytime_guests',
  'exclusive_rental',
  'parties_allowed',
  'pool',
  'pool_availability',
  'quiet_hours_start',
  'quiet_hours_end',
  'music_policy',
]);
const TEXT_FACILITIES = new Set([
  'outdoor_grill',
  'lawn',
  'sauna',
  'hot_tub',
  'recreation',
  'outdoor_covered_area',
  'indoor_fireplace',
]);
const SHAPE_COUNTS = new Set(['beds_count', 'rooms_count', 'bedrooms_count', 'bathrooms_count']);

export interface CategorizableClaim {
  target: string;
  sourceKey: string;
  method: string;
  locatorType: string;
  /** Structured field names or the text-span field path. */
  fields: string[];
}

/** The register's "Număr locuri" means classified places, whichever extractor reread it. */
export function isOfficialCapacity(claim: CategorizableClaim): boolean {
  return (
    claim.sourceKey === 'situr_accommodation_register' && claim.fields.includes('Număr locuri')
  );
}

export function categorize(claim: CategorizableClaim): CategoryId | null {
  const attribute = claim.target.replace(/^offer\./, '');
  if (attribute === 'primary_locality') {
    if (
      claim.sourceKey === 'situr_accommodation_register' &&
      claim.locatorType === 'structured_field'
    )
      return 'register_locality';
    if (
      claim.sourceKey === 'osm_geofabrik_romania' &&
      claim.locatorType === 'inferred' &&
      claim.method === 'osm-locality-inference@1'
    )
      return 'osm_county';
    return null;
  }
  if (attribute === 'sleeps_persons' && isOfficialCapacity(claim))
    return 'register_classified_capacity';
  if (HIGH_CONSEQUENCE.has(attribute)) return 'high_consequence';
  if (TEXT_FACILITIES.has(attribute) && claim.locatorType === 'text_span')
    return 'explicit_text_facility';
  if (SHAPE_COUNTS.has(attribute)) return 'property_shape_count';
  return null;
}

/** Claim targets the policy can categorize; the sampling frame is restricted to them. */
export const POLICY_TARGETS = [
  'offer.primary_locality',
  ...[...HIGH_CONSEQUENCE, ...TEXT_FACILITIES, ...SHAPE_COUNTS].map((a) => `offer.${a}`),
].sort();

/** Source authority for conditional cross-Candidate comparisons (higher wins). */
export const SOURCE_AUTHORITY: Record<string, number> = {
  situr_accommodation_register: 3,
  osm_geofabrik_romania: 1,
  overture_places: 1,
};

export function policyDocument() {
  return { version: POLICY_VERSION, categories: Object.values(CATEGORIES) };
}
