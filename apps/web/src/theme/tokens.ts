/**
 * Design tokens that are not part of MUI's standard theme shape.
 * Exposed on the theme as `theme.custom` (see augmentation.ts).
 */
export const customTokens = {
  layout: {
    headerHeight: 64,
    sidebarWidth: 264,
    sidebarCollapsedWidth: 72,
  },
  radii: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  shadows: {
    /** Subtle elevation for interactive surfaces (menus, popovers). */
    overlay: '0 4px 20px rgba(0, 0, 0, 0.12)',
    /** Hover emphasis for clickable cards. */
    raised: '0 2px 8px rgba(0, 0, 0, 0.10)',
  },
} as const;

export type CustomTokens = typeof customTokens;
