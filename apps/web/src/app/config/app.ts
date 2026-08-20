/** Central application metadata. Single source for names shown in UI, titles and logs. */
export const appConfig = {
  name: 'ELPA',
  shortName: 'ELPA',
  description:
    'Event Logistics and Planning App — discovery and recommendation for events and experiences.',
  /** Appended to route titles: "Data Studio · ELPA". */
  titleTemplate: (pageTitle?: string) =>
    pageTitle ? `${pageTitle} · ${appConfig.name}` : appConfig.name,
} as const;
