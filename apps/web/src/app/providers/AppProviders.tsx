import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, type ReactNode } from 'react';

import { AppSnackbar } from '@/components/feedback/AppSnackbar';
import { useLanguage } from '@/app/store/preferencesStore';
import { i18n } from '@/i18n';
import { env } from '@/lib/env';

import { AppThemeProvider } from './AppThemeProvider';
import { queryClient } from './queryClient';

/** Applies the persisted language preference to i18next and the <html> element. */
function LanguageSync() {
  const language = useLanguage();

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    document.documentElement.lang = language;
  }, [language]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <LanguageSync />
        {children}
        <AppSnackbar />
      </AppThemeProvider>
      {env.DEV && env.VITE_ENABLE_DEVTOOLS && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </QueryClientProvider>
  );
}
