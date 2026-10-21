import { Get, Param, Query, Res } from '@nestjs/common';
import { ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ZodResponse } from 'nestjs-zod';

import { AdminController } from '../common';
import { AcquisitionReportService } from './acquisition-report.service';
import { AcquisitionStudioService } from './acquisition-studio.service';
import {
  AcquisitionReportDto,
  AcquisitionRunListDto,
  CampaignParamsDto,
  CandidateDetailDto,
  CandidatePageDto,
  CandidateParamsDto,
  CandidateQueryDto,
  ImageParamsDto,
  DuplicateSuggestionPageDto,
  SuggestionQueryDto,
} from './dto/acquisition.dto';
import { VisualService } from './visual.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationListDto } from './dto/reconciliation.dto';

/**
 * Read-only inspection of the acquisition experiment. Runs are executed by the
 * research CLI (a long-running batch workload), never by an HTTP request.
 */
@ApiTags('studio-research')
@AdminController('research-campaigns')
export class AcquisitionController {
  constructor(
    private readonly studio: AcquisitionStudioService,
    private readonly reports: AcquisitionReportService,
    private readonly visual: VisualService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Get(':campaignId/candidates/:candidateId/images/:evidenceId/preview')
  @ApiProduces('image/png')
  @ApiResponse({
    status: 200,
    description: 'Administrator-only, metadata-stripped retained image preview.',
    schema: { type: 'string', format: 'binary' },
  })
  async imagePreview(@Param() params: ImageParamsDto, @Res() reply: FastifyReply) {
    const bytes = await this.visual.preview(
      params.campaignId,
      params.candidateId,
      params.evidenceId,
    );
    return reply
      .type('image/png')
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  }

  @Get(':campaignId/candidates/:candidateId/reconciliation')
  @ZodResponse({
    status: 200,
    type: ReconciliationListDto,
    description: 'Immutable research assessments; never verification or publication.',
  })
  reconciliationHistory(@Param() params: CandidateParamsDto): Promise<ReconciliationListDto> {
    return this.reconciliation.inspect(params.campaignId, params.candidateId);
  }

  @Get(':campaignId/acquisition-runs')
  @ZodResponse({
    status: 200,
    type: AcquisitionRunListDto,
    description: 'Acquisition Runs, newest first.',
  })
  listRuns(@Param() params: CampaignParamsDto): Promise<AcquisitionRunListDto> {
    return this.studio.listRuns(params.campaignId);
  }

  @Get(':campaignId/acquisition-report')
  @ZodResponse({
    status: 200,
    type: AcquisitionReportDto,
    description: 'Data-quality, cross-source, and coverage report computed from stored records.',
  })
  report(@Param() params: CampaignParamsDto): Promise<AcquisitionReportDto> {
    return this.reports.build(params.campaignId);
  }

  @Get(':campaignId/candidates')
  @ZodResponse({ status: 200, type: CandidatePageDto, description: 'Unverified Candidates.' })
  listCandidates(
    @Param() params: CampaignParamsDto,
    @Query() query: CandidateQueryDto,
  ): Promise<CandidatePageDto> {
    return this.studio.listCandidates(params.campaignId, query);
  }

  @Get(':campaignId/candidates/:candidateId')
  @ZodResponse({
    status: 200,
    type: CandidateDetailDto,
    description: 'A Candidate with its Claims, Evidence, run history, and duplicate suggestions.',
  })
  getCandidate(@Param() params: CandidateParamsDto): Promise<CandidateDetailDto> {
    return this.studio.getCandidate(params.campaignId, params.candidateId);
  }

  @Get(':campaignId/duplicate-suggestions')
  @ZodResponse({
    status: 200,
    type: DuplicateSuggestionPageDto,
    description: 'Explainable duplicate suggestions from the current matcher version.',
  })
  listSuggestions(
    @Param() params: CampaignParamsDto,
    @Query() query: SuggestionQueryDto,
  ): Promise<DuplicateSuggestionPageDto> {
    return this.studio.listSuggestions(params.campaignId, query);
  }
}
