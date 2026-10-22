import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CandidateQuery,
  studio,
  type SuggestionQuery,
  type VerificationDecisionList,
  type VerificationOverride,
} from '@/lib/apiClient';

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

export function useReconciliation(
  campaignId: string,
  candidateId: string,
  errorMessage: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...acquisitionKeys.candidate(campaignId, candidateId), 'reconciliation'],
    queryFn: ({ signal }) => studio.acquisition.reconciliation(campaignId, candidateId, signal),
    enabled,
    meta: { errorMessage },
  });
}

const verificationKeys = {
  policy: ['studio', 'verification', 'policy'] as const,
  candidate: (campaignId: string, candidateId: string) =>
    ['studio', 'verification', campaignId, candidateId] as const,
};

export function useVerificationPolicy(errorMessage: string, enabled: boolean) {
  return useQuery({
    queryKey: verificationKeys.policy,
    queryFn: ({ signal }) => studio.verification.policy(signal),
    enabled,
    meta: { errorMessage },
  });
}

export function useCandidateVerification(
  campaignId: string,
  candidateId: string,
  errorMessage: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: verificationKeys.candidate(campaignId, candidateId),
    queryFn: ({ signal }) => studio.verification.candidate(campaignId, candidateId, signal),
    enabled,
    meta: { errorMessage },
  });
}

export function useOverrideVerification(
  campaignId: string,
  candidateId: string,
  feedback: { errorMessage: string; successMessage: string },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['studio', 'verification', 'override'],
    mutationFn: ({ decisionId, input }: { decisionId: string; input: VerificationOverride }) =>
      studio.verification.override(decisionId, input),
    onSuccess: (decisions) => {
      queryClient.setQueryData<VerificationDecisionList>(
        verificationKeys.candidate(campaignId, candidateId),
        decisions,
      );
    },
    meta: feedback,
  });
}
