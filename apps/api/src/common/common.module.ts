import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { IncomingMessage } from 'node:http';
import { ClsModule, type ClsService } from 'nestjs-cls';
import { ZodSerializerInterceptor, createZodValidationPipe } from 'nestjs-zod';

import { resolveCorrelationId } from './context/cls';
import { CorrelationIdInterceptor } from './http/correlation-id-interceptor';
import { AppExceptionFilter } from './http/exception-filter';
import { LoggerModule } from './logging/logger.module';

const StrictZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
});

/**
 * Global common wiring. Provides:
 *   - `ClsModule` — request-scoped AsyncLocalStorage store shared with
 *     transactions (Commit 4) and logger correlation.
 *   - `LoggerModule` — nestjs-pino with correlation IDs.
 *   - Global `AppExceptionFilter` — one HTTP error shape (RFC 7807).
 *   - Global `CorrelationIdInterceptor` — correlation IDs on success responses.
 *
 * Marked `@Global()` so every module can inject `ClsService`,
 * `PinoLogger`, and the shared error types without repeating imports.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        // `setup` receives the base ClsService (untyped) — typed access
        // for consumers comes from injecting `ClsService<AppClsStore>`.
        setup: (cls: ClsService, req: IncomingMessage) => {
          cls.set('correlationId', resolveCorrelationId(req));
        },
      },
    }),
    LoggerModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: StrictZodValidationPipe,
    },
  ],
  exports: [ClsModule, LoggerModule],
})
export class CommonModule {}
