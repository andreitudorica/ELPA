import { api } from '@/lib/api/client';

import type { components, operations } from './generated/schema';

export type ResearchCampaign = components['schemas']['ResearchCampaign_Output'];
export type CreateResearchCampaign = components['schemas']['CreateResearchCampaign'];
export type Administrator = components['schemas']['Administrator_Output'];
export type ReconciliationList = components['schemas']['ReconciliationList_Output'];
export type AcquisitionRun = components['schemas']['AcquisitionRun_Output'];
export type AcquisitionReport = components['schemas']['AcquisitionReport_Output'];
export type CandidateSummary = components['schemas']['CandidateSummary_Output'];
export type CandidatePage = components['schemas']['CandidatePage_Output'];
export type CandidateDetail = components['schemas']['CandidateDetail_Output'];
export type DuplicateSuggestion = components['schemas']['DuplicateSuggestion_Output'];
export type DuplicateSuggestionPage = components['schemas']['DuplicateSuggestionPage_Output'];
export type CandidateQuery = NonNullable<
  operations['AcquisitionController_listCandidates']['parameters']['query']
>;
export type SuggestionQuery = NonNullable<
  operations['AcquisitionController_listSuggestions']['parameters']['query']
>;

export const identity = {
  currentAdministrator: () => api.get<Administrator>('/me'),
};

const withSignal = (signal?: AbortSignal) => (signal === undefined ? {} : { signal });
const campaignPath = (campaignId: string) =>
  `/admin/research-campaigns/${encodeURIComponent(campaignId)}`;

export const studio = {
  researchCampaigns: {
    list: (signal?: AbortSignal) =>
      api.get<ResearchCampaign[]>('/admin/research-campaigns', withSignal(signal)),
    create: (input: CreateResearchCampaign) =>
      api.post<ResearchCampaign>('/admin/research-campaigns', { body: input }),
  },
  acquisition: {
    reconciliation: (campaignId: string, candidateId: string, signal?: AbortSignal) =>
      api.get<ReconciliationList>(
        `${campaignPath(campaignId)}/candidates/${encodeURIComponent(candidateId)}/reconciliation`,
        withSignal(signal),
      ),
    imagePreview: (
      campaignId: string,
      candidateId: string,
      evidenceId: string,
      signal?: AbortSignal,
    ) =>
      api.getBlob(
        `${campaignPath(campaignId)}/candidates/${encodeURIComponent(candidateId)}/images/${encodeURIComponent(evidenceId)}/preview`,
        withSignal(signal),
      ),
    runs: (campaignId: string, signal?: AbortSignal) =>
      api.get<AcquisitionRun[]>(`${campaignPath(campaignId)}/acquisition-runs`, withSignal(signal)),
    report: (campaignId: string, signal?: AbortSignal) =>
      api.get<AcquisitionReport>(
        `${campaignPath(campaignId)}/acquisition-report`,
        withSignal(signal),
      ),
    candidates: (campaignId: string, query: CandidateQuery, signal?: AbortSignal) =>
      api.get<CandidatePage>(`${campaignPath(campaignId)}/candidates`, {
        query,
        ...withSignal(signal),
      }),
    candidate: (campaignId: string, candidateId: string, signal?: AbortSignal) =>
      api.get<CandidateDetail>(
        `${campaignPath(campaignId)}/candidates/${encodeURIComponent(candidateId)}`,
        withSignal(signal),
      ),
    suggestions: (campaignId: string, query: SuggestionQuery, signal?: AbortSignal) =>
      api.get<DuplicateSuggestionPage>(`${campaignPath(campaignId)}/duplicate-suggestions`, {
        query,
        ...withSignal(signal),
      }),
  },
};
