import { Body, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AdminController } from '../common';
import {
  CandidateVerificationParamsDto,
  DecisionParamsDto,
  VerificationDecisionListDto,
  VerificationOverrideDto,
  VerificationPolicyDto,
} from './dto/verification.dto';
import { VerificationService } from './verification.service';

/**
 * Inspection of Verification Decisions and the only human write: an audited
 * override. Machine decisions are produced by the research CLI, never here.
 */
@ApiTags('studio-verification')
@AdminController('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('policy')
  @ZodResponse({
    status: 200,
    type: VerificationPolicyDto,
    description: 'Versioned policy, approved eligibility and the latest evaluation summary.',
  })
  policy(): Promise<VerificationPolicyDto> {
    return this.verification.policy();
  }

  @Get('campaigns/:campaignId/candidates/:candidateId')
  @ZodResponse({
    status: 200,
    type: VerificationDecisionListDto,
    description: 'Decisions about the Candidate’s Claims; publication remains a separate decision.',
  })
  candidate(@Param() params: CandidateVerificationParamsDto): Promise<VerificationDecisionListDto> {
    return this.verification.inspectCandidate(params.campaignId, params.candidateId);
  }

  @Post('decisions/:decisionId/override')
  @ZodResponse({
    status: 201,
    type: VerificationDecisionListDto,
    description: 'Records an Administrator decision superseding one decision, with a reason.',
  })
  override(
    @Param() params: DecisionParamsDto,
    @Body() body: VerificationOverrideDto,
  ): Promise<VerificationDecisionListDto> {
    return this.verification.override(params.decisionId, body.outcome, body.reason);
  }
}
