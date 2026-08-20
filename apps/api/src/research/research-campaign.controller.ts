import { Body, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AdminController } from '../common';
import {
  CreateResearchCampaignDto,
  ResearchCampaignDto,
  ResearchCampaignListDto,
} from './dto/research-campaign.dto';
import { ResearchCampaignService } from './research-campaign.service';

@ApiTags('studio-research')
@AdminController('research-campaigns')
export class ResearchCampaignController {
  constructor(private readonly campaigns: ResearchCampaignService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: ResearchCampaignListDto,
    description: 'Research Campaigns ordered from newest to oldest.',
  })
  list(): Promise<ResearchCampaignDto[]> {
    return this.campaigns.list();
  }

  @Post()
  @ZodResponse({
    status: 201,
    type: ResearchCampaignDto,
    description: 'The newly opened Research Campaign.',
  })
  create(@Body() input: CreateResearchCampaignDto): Promise<ResearchCampaignDto> {
    return this.campaigns.create(input);
  }
}
