import { z } from 'zod';

export const VISUAL_SPEC_VERSION = 'grp-visual-observability@1';
export const VISUAL_FEATURES = [
  'pool',
  'gazebo',
  'outdoor_grill',
  'lawn',
  'outdoor_seating',
  'trampoline',
  'sports_court',
  'table_tennis',
  'parking_area',
] as const;
export const featureSchema = z.enum(VISUAL_FEATURES);
export type VisualFeature = z.infer<typeof featureSchema>;

export const FEATURE_DEFINITIONS: Record<
  VisualFeature,
  {
    meaning: string;
    textTarget: string | null;
    textValue: string | boolean | null;
    counterexample: string;
  }
> = {
  pool: {
    meaning: 'A clearly visible pool basin in this image',
    textTarget: 'offer.pool',
    textValue: true,
    counterexample:
      'A blue roof, covered basin or nearby public pool does not establish a guest pool.',
  },
  gazebo: {
    meaning: 'A visible freestanding gazebo or pavilion',
    textTarget: 'offer.outdoor_covered_area',
    textValue: 'gazebo',
    counterexample: 'A generic terrace or tree canopy is not a gazebo.',
  },
  outdoor_grill: {
    meaning: 'A visible barbecue structure or appliance',
    textTarget: 'offer.outdoor_grill',
    textValue: true,
    counterexample: 'A chimney or outdoor fireplace can be ambiguous.',
  },
  lawn: {
    meaning: 'A visible area of grass or lawn',
    textTarget: 'offer.lawn',
    textValue: true,
    counterexample: 'Grass does not establish flatness, usability, area or property boundaries.',
  },
  outdoor_seating: {
    meaning: 'Visible outdoor chairs, benches or seating',
    textTarget: null,
    textValue: null,
    counterexample: 'Visible chairs do not establish maximum event attendance.',
  },
  trampoline: {
    meaning: 'A visible trampoline',
    textTarget: null,
    textValue: null,
    counterexample: 'A round pool, covered object or stock image can resemble a trampoline.',
  },
  sports_court: {
    meaning: 'A visible marked sports court',
    textTarget: null,
    textValue: null,
    counterexample: 'A paved parking area is not necessarily a sports court.',
  },
  table_tennis: {
    meaning: 'A visible table-tennis table',
    textTarget: 'offer.recreation',
    textValue: 'table_tennis',
    counterexample:
      'A dining table or table in an adjacent property does not establish a guest facility.',
  },
  parking_area: {
    meaning: 'A visible area used or marked for parking',
    textTarget: null,
    textValue: null,
    counterexample: 'Cars on a public road do not establish private guest parking.',
  },
};

export const UNCERTAIN_VISUAL_FEATURES = [
  'yard_terrain',
  'usable_outdoor_space',
  'group_activity_suitability',
  'privacy',
  'neighbor_distance',
  'pool_property_relationship',
  'seating_capacity_impression',
] as const;
export const PROHIBITED_VISUAL_ASSERTIONS = [
  'private_event_permission',
  'loud_music_permission',
  'legal_event_capacity',
  'yard_area_m2',
  'property_boundaries',
  'current_seasonal_availability',
  'guest_exclusivity',
  'current_operation',
] as const;

export function visualSpecification() {
  return {
    version: VISUAL_SPEC_VERSION,
    direct: VISUAL_FEATURES.map((feature) => ({
      feature,
      ...FEATURE_DEFINITIONS[feature],
      entityLevel: 'image',
      absence: 'Not visible is not absent from the property.',
    })),
    uncertain: UNCERTAIN_VISUAL_FEATURES.map((feature) => ({
      feature,
      rule: 'Suggestion only; no numeric measurement or property-level fact.',
    })),
    prohibited: PROHIBITED_VISUAL_ASSERTIONS,
    examplesLanguage: 'ro',
    examples: [
      {
        sourceContext: 'Piscină publică la 300 m de pensiune.',
        visible: 'pool',
        attribution: 'nearby',
        propertyClaimAllowed: false,
      },
      {
        sourceContext: 'Fotografie de prezentare a foișorului.',
        visible: 'gazebo',
        attribution: 'unknown without reviewed property association',
        propertyClaimAllowed: false,
      },
      {
        sourceContext: 'Piscina este închisă iarna.',
        image: 'A summer photograph of a pool',
        interpretation: 'Compatible evidence, not a contradiction or current availability.',
      },
      {
        sourceContext: 'Curte în pantă.',
        image: 'A small level patch of lawn',
        interpretation: 'Potentially different areas; never overwrite the terrain Claim.',
      },
    ],
    promotion:
      'Research proposes image observations only. Curation remains responsible for verification and publication.',
  };
}
