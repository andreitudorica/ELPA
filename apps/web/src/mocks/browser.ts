import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/** MSW worker for the browser (local development and Storybook). */
export const worker = setupWorker(...handlers);
