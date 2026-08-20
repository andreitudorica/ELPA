import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { allNamespaces } from '@/i18n';

import { AppLink } from './routerLinks';

interface Crumb {
  routeId: string;
  pathname: string;
  label: string;
}

/**
 * Breadcrumb trail derived from the current route matches. Routes opt in by
 * declaring `staticData.breadcrumb` (see src/app/router/staticData.ts).
 */
export function AppBreadcrumbs() {
  const { t } = useTranslation(allNamespaces);
  const matches = useRouterState({ select: (state) => state.matches });

  const crumbs: Crumb[] = [];
  for (const match of matches) {
    const breadcrumb = match.staticData.breadcrumb;
    if (breadcrumb !== undefined) {
      const label = breadcrumb(t);
      const previous = crumbs[crumbs.length - 1];
      // Layout routes and their index route share a pathname — keep the deepest label.
      if (previous?.pathname === match.pathname) {
        previous.label = label;
        previous.routeId = match.routeId;
      } else {
        crumbs.push({ routeId: match.routeId, pathname: match.pathname, label });
      }
    }
  }

  if (crumbs.length < 2) {
    return null;
  }

  return (
    <Breadcrumbs aria-label={t('navigation.breadcrumbs')} separator="›">
      {crumbs.map((crumb, index) =>
        index === crumbs.length - 1 ? (
          <Typography key={crumb.routeId} variant="body2" color="text.primary">
            {crumb.label}
          </Typography>
        ) : (
          <AppLink key={crumb.routeId} to={crumb.pathname} variant="body2" color="text.secondary">
            {crumb.label}
          </AppLink>
        ),
      )}
    </Breadcrumbs>
  );
}
