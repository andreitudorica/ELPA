import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { AuditRepository } from '../audit';
import { type AppClsStore, AuthenticationError, NotFoundError } from '../common';
import { UnitOfWork } from '../database';
import { CandidateClaimsRepository } from './candidate-claims.repository';
import { generateDuplicateSuggestions, MATCHER_VERSION } from './matching/duplicate-matcher';
import { MATCH_CLAIM_TARGETS, matchFeaturesFromClaims } from './matching/match-features';
import { ResearchCampaignRepository } from './research-campaign.repository';

export interface DuplicateDetectionOutcome {
  matcherVersion: string;
  candidates: number;
  pairsCompared: number;
  broadIdentifiers: string[];
  suggestions: number;
  suggestionsCreated: number;
  byRelationAndStrength: Record<string, number>;
}

/**
 * Generates explainable duplicate suggestions for a campaign's Candidates.
 * Re-running the same matcher version is idempotent; a new version adds a
 * new, separately inspectable set of suggestions and leaves earlier ones.
 */
@Injectable()
export class DuplicateSuggestionService {
  constructor(
    private readonly campaigns: ResearchCampaignRepository,
    private readonly candidateClaims: CandidateClaimsRepository,
    private readonly audit: AuditRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async generate(researchCampaignId: string): Promise<DuplicateDetectionOutcome> {
    const administrator = this.cls.get('administrator');
    if (administrator === undefined) {
      throw new AuthenticationError('No administrator resolved for duplicate detection');
    }
    const campaign = await this.campaigns.findById(researchCampaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`Research Campaign ${researchCampaignId} does not exist`);
    }

    const claimSets = await this.candidateClaims.loadLatestClaims(campaign.id, MATCH_CLAIM_TARGETS);
    const run = generateDuplicateSuggestions(
      claimSets.map((candidate) => matchFeaturesFromClaims(candidate, candidate.claims)),
    );
    const drafts = run.suggestions;
    const byRelationAndStrength: Record<string, number> = {};
    for (const draft of drafts) {
      const key = `${draft.relation}:${draft.strength}`;
      byRelationAndStrength[key] = (byRelationAndStrength[key] ?? 0) + 1;
    }

    const suggestionsCreated = await this.unitOfWork.run(async () => {
      const created = await this.candidateClaims.storeSuggestions(
        campaign.id,
        MATCHER_VERSION,
        drafts,
      );
      await this.audit.record({
        action: 'duplicate_suggestions.generated',
        targetType: 'ResearchCampaign',
        targetId: campaign.id,
        administratorId: administrator.id,
        metadata: { matcherVersion: MATCHER_VERSION, suggestions: drafts.length, created },
      });
      return created;
    });

    return {
      matcherVersion: MATCHER_VERSION,
      candidates: claimSets.length,
      pairsCompared: run.pairsCompared,
      broadIdentifiers: run.broadIdentifiers,
      suggestions: drafts.length,
      suggestionsCreated,
      byRelationAndStrength,
    };
  }
}
