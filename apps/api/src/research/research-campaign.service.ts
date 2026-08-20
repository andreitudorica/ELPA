import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { AccessService } from '../access';
import { AuditRepository } from '../audit';
import { CatalogService, GROUP_RENTAL_PROPERTY_CATEGORY_KEY } from '../catalog';
import { type AdministratorIdentity, type AppClsStore, AuthenticationError } from '../common';
import { UnitOfWork, uuidV7 } from '../database';
import {
  type CreateResearchCampaignDto,
  type ResearchCampaignDto,
} from './dto/research-campaign.dto';
import {
  type ResearchCampaignRecord,
  ResearchCampaignRepository,
} from './research-campaign.repository';

@Injectable()
export class ResearchCampaignService {
  constructor(
    private readonly campaigns: ResearchCampaignRepository,
    private readonly access: AccessService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async create(input: CreateResearchCampaignDto): Promise<ResearchCampaignDto> {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) {
      throw new AuthenticationError('No administrator resolved for this request');
    }

    return this.unitOfWork.run(async () => {
      const category = await this.catalog.requireCategory(GROUP_RENTAL_PROPERTY_CATEGORY_KEY);
      const now = new Date();
      const id = uuidV7();

      await this.campaigns.create({
        id,
        name: input.name,
        eventNeed: input.eventNeed,
        categoryId: category.id,
        countryCode: 'RO',
        county: input.county,
        locality: input.locality ?? null,
        minimumCriteria: input.minimumCriteria,
        createdByAdministratorId: administrator.id,
        investigatedSources: [...new Set(input.investigatedSources)],
        createdAt: now,
        updatedAt: now,
      });

      await this.audit.record({
        action: 'research_campaign.created',
        targetType: 'ResearchCampaign',
        targetId: id,
        administratorId: administrator.id,
        metadata: {
          categoryKey: category.key,
          countryCode: 'RO',
        },
      });

      return {
        id,
        name: input.name,
        eventNeed: input.eventNeed,
        category: GROUP_RENTAL_PROPERTY_CATEGORY_KEY,
        countryCode: 'RO',
        county: input.county,
        locality: input.locality ?? null,
        minimumCriteria: input.minimumCriteria,
        investigatedSources: [...new Set(input.investigatedSources)],
        createdBy: administrator,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    });
  }

  async list(): Promise<ResearchCampaignDto[]> {
    const category = await this.catalog.requireCategory(GROUP_RENTAL_PROPERTY_CATEGORY_KEY);
    const campaigns = await this.campaigns.listByScope(category.id, 'RO');
    const administrators = await this.access.findAdministratorsByIds(
      campaigns.map(({ createdByAdministratorId }) => createdByAdministratorId),
    );
    const administratorsById = new Map(
      administrators.map((administrator) => [administrator.id, administrator]),
    );

    return campaigns.map((campaign) => {
      const administrator = administratorsById.get(campaign.createdByAdministratorId);
      if (administrator === undefined) {
        throw new Error(`ResearchCampaign ${campaign.id} references a missing Administrator`);
      }
      return this.toDto(campaign, administrator);
    });
  }

  private toDto(
    campaign: ResearchCampaignRecord,
    administrator: AdministratorIdentity,
  ): ResearchCampaignDto {
    return {
      id: campaign.id,
      name: campaign.name,
      eventNeed: campaign.eventNeed,
      category: GROUP_RENTAL_PROPERTY_CATEGORY_KEY,
      countryCode: 'RO',
      county: campaign.county,
      locality: campaign.locality,
      minimumCriteria: campaign.minimumCriteria,
      investigatedSources: campaign.investigatedSources,
      createdBy: administrator,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}
