import 'reflect-metadata';

import { Logger } from 'nestjs-pino';

import { createApplication } from './application';
import { loadEnv } from './config/env';

/**
 * Bootstrap sequence (per ADR 0007 + Phase A):
 *   1. Validate env with Zod → fail-fast on malformed values.
 *   2. Build the configured Nest + Fastify application.
 *   3. Listen on the configured host/port.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await createApplication();

  await app.listen({ host: env.API_HOST, port: env.API_PORT });

  app.get(Logger).log(`listening on ${env.API_BASE_URL} (env=${env.NODE_ENV})`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  console.error('[apps/api] fatal error during bootstrap:', err);
  process.exit(1);
});
