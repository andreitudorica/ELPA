/**
 * Central route path definitions for the two audience families (ADR 0015).
 *
 * TanStack Router owns route typing (paths are checked at compile time), but
 * link targets used across route trees (redirects, breadcrumbs) live here so a
 * moved route only has to be updated in one place.
 */
export const routePaths = {
  publicHome: '/',
  studioRoot: '/studio',
  studioHome: '/studio/',
  studioResearchCampaigns: '/studio/research-campaigns',
  studioUnauthorized: '/studio/unauthorized',
} as const;

export type RoutePath = (typeof routePaths)[keyof typeof routePaths];
