import { type TFunction } from 'i18next';

import { type allNamespaces } from '@/i18n';

/** `t` spanning every namespace, so routes can use keys like `users:title`. */
export type RouteTFunction = TFunction<typeof allNamespaces>;

/**
 * Route metadata conventions. Routes declare translated titles and breadcrumb
 * labels as functions of `t`, so document titles and breadcrumbs stay reactive
 * to language changes and fully type-checked against the i18n resources.
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Document title for this route (deepest match wins). */
    title?: (t: RouteTFunction) => string;
    /** Breadcrumb label; routes without it are skipped in the trail. */
    breadcrumb?: (t: RouteTFunction) => string;
  }
}

export {};
