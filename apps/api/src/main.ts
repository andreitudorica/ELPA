import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/**
 * Bootstrap sequence (per ADR 0007 + Phase A):
 *   1. Validate env with Zod → fail-fast if malformed (never boots
 *      production with silent defaults).
 *   2. Instantiate Nest on the Fastify adapter.
 *   3. Apply a global `/api` prefix; every route in the app lives under
 *      it, matching the public/admin split introduced in Q5.
 *   4. Listen on the configured host/port.
 *
 * Deliberately minimal — later Phase A commits layer in CLS, the
 * exception filter, the admin-controller decorator, boot-time route
 * verification, and OpenAPI generation without touching this sequence.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  app.setGlobalPrefix('api');

  await app.listen({ host: env.API_HOST, port: env.API_PORT });

  console.log(`[apps/api] listening on ${env.API_BASE_URL} (env=${env.NODE_ENV})`);
}

bootstrap().catch((err: unknown) => {
  console.error('[apps/api] fatal error during bootstrap:', err);
  process.exit(1);
});
