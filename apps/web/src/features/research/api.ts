import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { studio, type CreateResearchCampaign, type ResearchCampaign } from '@/lib/apiClient';

const campaignKeys = {
  all: ['studio', 'research-campaigns'] as const,
};

interface RequestFeedback {
  errorMessage: string;
  successMessage?: string;
}

export function useResearchCampaigns(errorMessage: string) {
  return useQuery({
    queryKey: campaignKeys.all,
    queryFn: ({ signal }) => studio.researchCampaigns.list(signal),
    meta: { errorMessage },
  });
}

export function useCreateResearchCampaign(feedback: RequestFeedback) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['studio', 'research-campaigns', 'create'],
    mutationFn: (input: CreateResearchCampaign) => studio.researchCampaigns.create(input),
    onSuccess: (campaign) => {
      queryClient.setQueryData<ResearchCampaign[]>(campaignKeys.all, (current) =>
        current === undefined ? [campaign] : [campaign, ...current],
      );
    },
    meta: feedback,
  });
}
