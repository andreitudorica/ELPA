import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type CandidateQuery, studio, type SuggestionQuery } from '@/lib/apiClient';

const acquisitionKeys = {
  all: (campaignId: string) => ['studio', 'acquisition', campaignId] as const,
  runs: (campaignId: string) => [...acquisitionKeys.all(campaignId), 'runs'] as const,
  report: (campaignId: string) => [...acquisitionKeys.all(campaignId), 'report'] as const,
  candidates: (campaignId: string, query: CandidateQuery) =>
    [...acquisitionKeys.all(campaignId), 'candidates', query] as const,
  candidate: (campaignId: string, candidateId: string) =>
    [...acquisitionKeys.all(campaignId), 'candidate', candidateId] as const,
  suggestions: (campaignId: string, query: SuggestionQuery) =>
    [...acquisitionKeys.all(campaignId), 'suggestions', query] as const,
};

export function useAcquisitionRuns(campaignId: string, errorMessage: string) {
  return useQuery({
    queryKey: acquisitionKeys.runs(campaignId),
    queryFn: ({ signal }) => studio.acquisition.runs(campaignId, signal),
    meta: { errorMessage },
  });
}

export function useAcquisitionReport(campaignId: string, errorMessage: string) {
  return useQuery({
    queryKey: acquisitionKeys.report(campaignId),
    queryFn: ({ signal }) => studio.acquisition.report(campaignId, signal),
    meta: { errorMessage },
  });
}

export function useCandidates(campaignId: string, query: CandidateQuery, errorMessage: string) {
  return useQuery({
    queryKey: acquisitionKeys.candidates(campaignId, query),
    queryFn: ({ signal }) => studio.acquisition.candidates(campaignId, query, signal),
    placeholderData: keepPreviousData,
    meta: { errorMessage },
  });
}

export function useCandidate(campaignId: string, candidateId: string, errorMessage: string) {
  return useQuery({
    queryKey: acquisitionKeys.candidate(campaignId, candidateId),
    queryFn: ({ signal }) => studio.acquisition.candidate(campaignId, candidateId, signal),
    meta: { errorMessage },
  });
}

export function useDuplicateSuggestions(
  campaignId: string,
  query: SuggestionQuery,
  errorMessage: string,
) {
  return useQuery({
    queryKey: acquisitionKeys.suggestions(campaignId, query),
    queryFn: ({ signal }) => studio.acquisition.suggestions(campaignId, query, signal),
    placeholderData: keepPreviousData,
    meta: { errorMessage },
  });
}
