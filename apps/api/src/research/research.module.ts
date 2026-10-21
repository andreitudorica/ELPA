import { Module } from '@nestjs/common';

import { AccessModule } from '../access';
import { AuditModule } from '../audit';
import { CatalogModule } from '../catalog';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionQueryRepository } from './acquisition-query.repository';
import { AcquisitionReportService } from './acquisition-report.service';
import { AcquisitionRepository } from './acquisition.repository';
import { AcquisitionRunService } from './acquisition-run.service';
import { AcquisitionStudioService } from './acquisition-studio.service';
import { CandidateClaimsRepository } from './candidate-claims.repository';
import { DuplicateSuggestionService } from './duplicate-suggestion.service';
import { EvaluationService } from './evaluation.service';
import { ExtractionService } from './extraction.service';
import { ExtractionRepository } from './extraction.repository';
import { ResearchCampaignController } from './research-campaign.controller';
import { ResearchCampaignRepository } from './research-campaign.repository';
import { ResearchCampaignService } from './research-campaign.service';

@Module({
  imports: [AccessModule, CatalogModule, AuditModule],
  controllers: [ResearchCampaignController, AcquisitionController],
  providers: [
    ResearchCampaignRepository,
    ResearchCampaignService,
    AcquisitionRepository,
    AcquisitionQueryRepository,
    AcquisitionRunService,
    AcquisitionStudioService,
    AcquisitionReportService,
    CandidateClaimsRepository,
    DuplicateSuggestionService,
    EvaluationService,
    ExtractionService,
    ExtractionRepository,
  ],
  exports: [
    ResearchCampaignService,
    AcquisitionRunService,
    AcquisitionReportService,
    DuplicateSuggestionService,
    EvaluationService,
    ExtractionService,
  ],
})
export class ResearchModule {}
