import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/** MSW server for Node (Vitest). Lifecycle is managed in src/test/setup.ts. */
export const server = setupServer(...handlers);
