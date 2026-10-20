import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const trimmedRequiredText = z.string().trim().min(1).max(500);
const optionalTrimmedText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const CreateResearchCampaignSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    eventNeed: trimmedRequiredText,
    /** Omit for a national campaign covering all of Romania. */
    county: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => (value === '' ? undefined : value))
      .refine((value) => value === undefined || value.length >= 2, {
        message: 'County must contain at least 2 characters',
      }),
    locality: optionalTrimmedText,
    minimumCriteria: z.array(trimmedRequiredText).min(1).max(20),
    investigatedSources: z.array(z.url()).min(1).max(50),
  })
  .refine((input) => input.locality === undefined || input.county !== undefined, {
    message: 'A locality requires a county; locality names repeat across counties',
    path: ['locality'],
  })
  .meta({ id: 'CreateResearchCampaign' });

export class CreateResearchCampaignDto extends createZodDto(CreateResearchCampaignSchema) {}

export const ResearchCampaignSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    eventNeed: z.string(),
    category: z.literal('group_rental_property'),
    countryCode: z.literal('RO'),
    county: z.string().nullable(),
    locality: z.string().nullable(),
    minimumCriteria: z.array(z.string()),
    investigatedSources: z.array(z.url()),
    createdBy: z.object({
      id: z.uuid(),
      email: z.email(),
      displayName: z.string(),
    }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'ResearchCampaign' });

export class ResearchCampaignDto extends createZodDto(ResearchCampaignSchema) {}

export const ResearchCampaignListSchema = z
  .array(ResearchCampaignSchema)
  .meta({ id: 'ResearchCampaignList' });

export class ResearchCampaignListDto extends createZodDto(ResearchCampaignListSchema) {}
