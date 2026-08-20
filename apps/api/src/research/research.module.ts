import { Module } from '@nestjs/common';

import { AccessModule } from '../access';
import { AuditModule } from '../audit';
import { CatalogModule } from '../catalog';
import { ResearchCampaignController } from './research-campaign.controller';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { ResearchCampaignService } from './research-campaign.service';

@Module({
  imports: [AccessModule, CatalogModule, AuditModule],
  controllers: [ResearchCampaignController],
  providers: [ResearchCampaignRepository, ResearchCampaignService],
})
export class ResearchModule {}
