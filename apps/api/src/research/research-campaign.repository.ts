import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { DatabaseService, uuidV7 } from '../database';
import { researchCampaigns, researchCampaignSources } from './research.schema';

export interface NewResearchCampaignRecord {
  id: string;
  name: string;
  eventNeed: string;
  categoryId: string;
  countryCode: 'RO';
  county: string;
  locality: string | null;
  minimumCriteria: string[];
  createdByAdministratorId: string;
  investigatedSources: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchCampaignRecord {
  id: string;
  name: string;
  eventNeed: string;
  countryCode: string;
  county: string;
  locality: string | null;
  minimumCriteria: string[];
  investigatedSources: string[];
  createdByAdministratorId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResearchCampaignRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: NewResearchCampaignRecord): Promise<void> {
    await this.database.executor.insert(researchCampaigns).values({
      id: input.id,
      name: input.name,
      eventNeed: input.eventNeed,
      categoryId: input.categoryId,
      countryCode: input.countryCode,
      county: input.county,
      locality: input.locality,
      minimumCriteria: input.minimumCriteria,
      createdByAdministratorId: input.createdByAdministratorId,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });

    await this.database.executor.insert(researchCampaignSources).values(
      input.investigatedSources.map((url) => ({
        id: uuidV7(),
        researchCampaignId: input.id,
        url,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })),
    );
  }

  async listByScope(categoryId: string, countryCode: 'RO'): Promise<ResearchCampaignRecord[]> {
    const campaigns = await this.database.executor
      .select({
        id: researchCampaigns.id,
        name: researchCampaigns.name,
        eventNeed: researchCampaigns.eventNeed,
        countryCode: researchCampaigns.countryCode,
        county: researchCampaigns.county,
        locality: researchCampaigns.locality,
        minimumCriteria: researchCampaigns.minimumCriteria,
        createdByAdministratorId: researchCampaigns.createdByAdministratorId,
        createdAt: researchCampaigns.createdAt,
        updatedAt: researchCampaigns.updatedAt,
      })
      .from(researchCampaigns)
      .where(
        and(
          eq(researchCampaigns.categoryId, categoryId),
          eq(researchCampaigns.countryCode, countryCode),
        ),
      )
      .orderBy(desc(researchCampaigns.createdAt));

    if (campaigns.length === 0) return [];

    const sources = await this.database.executor
      .select({
        researchCampaignId: researchCampaignSources.researchCampaignId,
        url: researchCampaignSources.url,
      })
      .from(researchCampaignSources)
      .where(
        inArray(
          researchCampaignSources.researchCampaignId,
          campaigns.map(({ id }) => id),
        ),
      )
      .orderBy(researchCampaignSources.createdAt);

    const sourcesByCampaign = new Map<string, string[]>();
    for (const source of sources) {
      const campaignSources = sourcesByCampaign.get(source.researchCampaignId) ?? [];
      campaignSources.push(source.url);
      sourcesByCampaign.set(source.researchCampaignId, campaignSources);
    }

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      eventNeed: campaign.eventNeed,
      countryCode: campaign.countryCode,
      county: campaign.county,
      locality: campaign.locality,
      minimumCriteria: campaign.minimumCriteria,
      investigatedSources: sourcesByCampaign.get(campaign.id) ?? [],
      createdByAdministratorId: campaign.createdByAdministratorId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    }));
  }
}
