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
    county: z.string().trim().min(2).max(100),
    locality: optionalTrimmedText,
    minimumCriteria: z.array(trimmedRequiredText).min(1).max(20),
    investigatedSources: z.array(z.url()).min(1).max(50),
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
    county: z.string(),
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
