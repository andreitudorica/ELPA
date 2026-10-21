import { z } from 'zod';

/**
 * URL state of the acquisition experiment page (state ownership: the router
 * owns tab, filters, and pagination so views are shareable and restorable).
 */
export const acquisitionTabs = ['runs', 'report', 'candidates', 'suggestions'] as const;
export type AcquisitionTab = (typeof acquisitionTabs)[number];

export const sourceKeys = [
  'situr_accommodation_register',
  'osm_geofabrik_romania',
  'overture_places',
] as const;
export const screeningClasses = [
  'plausible',
  'ambiguous',
  'out_of_scope',
  'insufficient_data',
] as const;

/** Every field is optional so links only state what they change; readers apply defaults. */
export const acquisitionSearchSchema = z.object({
  tab: z.enum(acquisitionTabs).optional().catch(undefined),
  source: z.enum(sourceKeys).optional().catch(undefined),
  screening: z.enum(screeningClasses).optional().catch(undefined),
  county: z
    .string()
    .regex(/^RO-[A-Z]{1,2}$/)
    .optional()
    .catch(undefined),
  search: z.string().max(100).optional().catch(undefined),
  match: z.enum(['with_suggestions', 'without_suggestions']).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  relation: z.enum(['same_property', 'same_provider']).optional().catch(undefined),
  strength: z.enum(['likely', 'possible']).optional().catch(undefined),
  suggestionsPage: z.number().int().min(1).optional().catch(undefined),
});

export type AcquisitionSearch = z.infer<typeof acquisitionSearchSchema>;
export type AcquisitionSearchUpdate = Partial<AcquisitionSearch>;

/** Drops undefined entries so optional API query fields are omitted, not sent empty. */
export function definedEntries<T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
