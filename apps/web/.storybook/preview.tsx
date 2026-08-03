import '@fontsource-variable/roboto';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { type Decorator, type Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { useEffect } from 'react';

import { i18n, initI18n, isSupportedLanguage } from '../src/i18n';
import { dateLocales } from '../src/i18n/dateLocales';
import { handlers } from '../src/mocks/handlers';
import { createAppTheme } from '../src/theme';

// MSW: stories can override handlers via parameters.msw.handlers.
initialize({ onUnhandledRequest: 'bypass' }, handlers);

void initI18n('en');

const withProviders: Decorator = (Story, context) => {
  const mode = context.globals.colorScheme === 'dark' ? 'dark' : 'light';
  const locale = isSupportedLanguage(context.globals.locale) ? context.globals.locale : 'en';

  // eslint-disable-next-line react-hooks/rules-of-hooks -- decorators are components
  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    document.documentElement.setAttribute('data-color-scheme', mode);
  }, [mode]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider key={mode} theme={createAppTheme()} defaultMode={mode} storageManager={null}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateLocales[locale]}>
          <Story />
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

/** Wraps stories in a real (memory-history) router so Link/useNavigate work. */
const withRouter: Decorator = (Story) => {
  const rootRoute = createRootRoute({ component: () => <Story /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return <RouterProvider router={router} />;
};

const preview: Preview = {
  decorators: [withRouter, withProviders],
  loaders: [mswLoader],
  globalTypes: {
    colorScheme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'ro', title: 'Română' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorScheme: 'light',
    locale: 'en',
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Fail stories on serious accessibility violations in test runs.
      test: 'error',
    },
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default preview;
