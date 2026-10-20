import type { CreateResearchCampaignDto } from './dto/research-campaign.dto';

/**
 * The national Research Campaign used by the acquisition baseline experiment
 * (docs/research/group-rental-property-baseline/). Romanian user-facing text.
 */
export const BASELINE_CAMPAIGN: CreateResearchCampaignDto = {
  name: 'Bază de referință achiziție — proprietăți pentru grupuri (România)',
  eventNeed:
    'Proprietăți închiriate integral pentru șederi de grup, petreceri private, grătare și team-building.',
  // National scope: every county.
  county: undefined,
  locality: undefined,
  minimumCriteria: [
    'Proprietatea poate fi închiriată integral, fără spații comune cu alți oaspeți',
    'Capacitate de cazare de cel puțin 6 persoane',
    'Situată în România',
  ],
  investigatedSources: [
    'https://se.situr.gov.ro/OpenData/OpenDataMain',
    'https://download.geofabrik.de/europe/romania.html',
  ],
};
