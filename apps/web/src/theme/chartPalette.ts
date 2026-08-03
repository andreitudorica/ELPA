import { type Theme } from '@mui/material/styles';

/**
 * Series colors for MUI X Charts, derived from the active theme so charts
 * automatically match light/dark mode. Pass to a chart's `colors` prop.
 */
export function getChartPalette(theme: Theme): string[] {
  return [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
  ];
}
