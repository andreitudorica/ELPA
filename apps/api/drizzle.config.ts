import { defineConfig } from 'drizzle-kit';

import { loadEnv } from './src/config/env';

const env = loadEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/drizzle/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
