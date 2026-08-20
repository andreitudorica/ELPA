import CssBaseline from '@mui/material/CssBaseline';
import { roRO as materialRoRO } from '@mui/material/locale';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { roRO as pickersRoRO } from '@mui/x-date-pickers/locales';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useEffect, useMemo, type ReactNode } from 'react';

import { useLanguage, useThemeMode } from '@/app/store/preferencesStore';
import { dateLocales } from '@/i18n/dateLocales';
import { createAppTheme } from '@/theme';

/**
 * Keeps MUI's resolved color scheme in sync with the Zustand preference.
 * `storageManager={null}` on the provider disables MUI's own persistence so
 * the preferences store stays the single source of truth.
 */
function ModeSync() {
  const themeMode = useThemeMode();
  const { mode, setMode } = useColorScheme();

  useEffect(() => {
    if (mode !== themeMode) {
      setMode(themeMode);
    }
  }, [mode, setMode, themeMode]);

  return null;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const language = useLanguage();

  const theme = useMemo(
    () => createAppTheme(...(language === 'ro' ? [materialRoRO, pickersRoRO] : [])),
    [language],
  );

  return (
    <ThemeProvider theme={theme} defaultMode="system" storageManager={null}>
      <ModeSync />
      <CssBaseline enableColorScheme />
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateLocales[language]}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
