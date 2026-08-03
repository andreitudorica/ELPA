import { createTheme, type Theme } from '@mui/material/styles';

import './augmentation.ts';
import { customTokens } from './tokens';

const fontFamily = [
  '"Roboto Variable"',
  'Roboto',
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  'sans-serif',
].join(', ');

/**
 * Central application theme.
 *
 * - CSS variables + `data-color-scheme` selector: both color schemes are compiled
 *   into CSS custom properties, so switching light/dark/system is instant and the
 *   inline script in index.html can apply the scheme before first paint.
 * - `localeOverrides` accepts entries from `@mui/material/locale` (e.g. `roRO`)
 *   to translate built-in component strings (TablePagination, etc.).
 */
export function createAppTheme(...localeOverrides: object[]): Theme {
  return createTheme(
    {
      cssVariables: {
        colorSchemeSelector: 'data-color-scheme',
      },
      colorSchemes: {
        light: {
          palette: {
            primary: { main: '#1565c0' },
            secondary: { main: '#546e7a' },
            success: { main: '#2e7d32' },
            warning: { main: '#e65100' },
            error: { main: '#c62828' },
            info: { main: '#0277bd' },
            background: { default: '#f6f8fa', paper: '#ffffff' },
            text: { primary: '#1a2027', secondary: '#4b5563' },
            divider: 'rgba(0, 0, 0, 0.10)',
          },
        },
        dark: {
          palette: {
            primary: { main: '#90caf9' },
            secondary: { main: '#b0bec5' },
            success: { main: '#81c784' },
            warning: { main: '#ffb74d' },
            error: { main: '#ef9a9a' },
            info: { main: '#4fc3f7' },
            background: { default: '#10151a', paper: '#171d24' },
            text: { primary: '#e6eaf0', secondary: '#9aa4b1' },
            divider: 'rgba(255, 255, 255, 0.10)',
          },
        },
      },
      typography: {
        fontFamily,
        h1: { fontSize: '2rem', fontWeight: 600, lineHeight: 1.25 },
        h2: { fontSize: '1.625rem', fontWeight: 600, lineHeight: 1.3 },
        h3: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.35 },
        h4: { fontSize: '1.185rem', fontWeight: 600, lineHeight: 1.4 },
        h5: { fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.4 },
        h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.45 },
        subtitle1: { fontSize: '0.9375rem', fontWeight: 500 },
        subtitle2: { fontSize: '0.875rem', fontWeight: 500 },
        body1: { fontSize: '0.9375rem' },
        body2: { fontSize: '0.875rem' },
        button: { textTransform: 'none', fontWeight: 500 },
        caption: { fontSize: '0.75rem' },
      },
      shape: {
        borderRadius: customTokens.radii.md,
      },
      breakpoints: {
        values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
      },
      custom: customTokens,
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: customTokens.radii.sm + 2 },
          },
        },
        MuiButtonBase: {
          defaultProps: {
            // Keyboard focus is indicated with a visible outline (see focus styles
            // below) instead of the ripple-only default.
            disableTouchRipple: false,
          },
        },
        MuiTextField: {
          defaultProps: { variant: 'outlined', size: 'small' },
        },
        MuiFormControl: {
          defaultProps: { size: 'small' },
        },
        MuiCard: {
          defaultProps: { variant: 'outlined' },
        },
        MuiAppBar: {
          defaultProps: { elevation: 0, color: 'transparent' },
        },
        MuiChip: {
          defaultProps: { size: 'small' },
        },
        MuiTooltip: {
          defaultProps: { arrow: true },
        },
        MuiTable: {
          defaultProps: { size: 'small' },
        },
        MuiTableCell: {
          styleOverrides: {
            head: ({ theme }) => ({
              fontWeight: 600,
              color: theme.vars.palette.text.secondary,
              whiteSpace: 'nowrap',
            }),
          },
        },
        MuiDialog: {
          defaultProps: { maxWidth: 'sm', fullWidth: true },
        },
        MuiLink: {
          defaultProps: { underline: 'hover' },
        },
        MuiMenu: {
          styleOverrides: {
            paper: { boxShadow: customTokens.shadows.overlay },
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            ':focus-visible': {
              outline: '2px solid var(--mui-palette-primary-main)',
              outlineOffset: 2,
            },
            '@media (prefers-reduced-motion: reduce)': {
              '*, *::before, *::after': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              },
            },
          },
        },
      },
    },
    ...localeOverrides,
  );
}
