import '@fontsource-variable/roboto';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/AppProviders';
import { RootErrorBoundary } from '@/app/providers/RootErrorBoundary';
import { router } from '@/app/router/router';
import { usePreferencesStore } from '@/app/store/preferencesStore';
import { initI18n } from '@/i18n';
import { env, EnvValidationError } from '@/lib/env';
import { logger } from '@/lib/logger';

function renderFatalError(message: string): void {
  const root = document.getElementById('root');
  if (root !== null) {
    const heading = document.createElement('h1');
    heading.textContent = 'Configuration error';
    const body = document.createElement('pre');
    body.textContent = message;
    body.style.whiteSpace = 'pre-wrap';
    root.replaceChildren(heading, body);
    root.style.cssText = 'max-width:560px;margin:15vh auto;font-family:system-ui,sans-serif;';
  }
}

async function enableMocking(): Promise<void> {
  // Defence in depth: MSW must never reach production. `import.meta.env.DEV`
  // handles the local build, and VITE_APP_ENV catches deploys that identify as
  // production even when DEV is misinterpreted. See ADR 0016.
  if (!env.VITE_ENABLE_MOCKS) {
    return;
  }
  if (env.VITE_APP_ENV === 'production') {
    logger.warn('MSW requested in production build — refusing to start worker.');
    return;
  }
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

async function bootstrap(): Promise<void> {
  await enableMocking();
  await initI18n(usePreferencesStore.getState().language);

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason);
  });

  const rootElement = document.getElementById('root');
  if (rootElement === null) {
    throw new Error('Root element #root not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </RootErrorBoundary>
    </StrictMode>,
  );
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof EnvValidationError
      ? error.message
      : 'The application failed to start. Check the console for details.';
  logger.error('Bootstrap failed', error);
  renderFatalError(message);
});
