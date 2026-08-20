import { api } from '@/lib/api/client';

import type { components } from './generated/schema';

export type ResearchCampaign = components['schemas']['ResearchCampaign_Output'];
export type CreateResearchCampaign = components['schemas']['CreateResearchCampaign'];
export type Administrator = components['schemas']['Administrator_Output'];

export const identity = {
  currentAdministrator: () => api.get<Administrator>('/me'),
};

export const studio = {
  researchCampaigns: {
    list: (signal?: AbortSignal) =>
      api.get<ResearchCampaign[]>(
        '/admin/research-campaigns',
        signal === undefined ? {} : { signal },
      ),
    create: (input: CreateResearchCampaign) =>
      api.post<ResearchCampaign>('/admin/research-campaigns', { body: input }),
  },
};
