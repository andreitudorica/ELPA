import { Module } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { ClsService } from 'nestjs-cls';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { loadEnv, resolveLogLevel } from '../../config/env';
import type { AppClsStore } from '../context/cls';
import { resolveCorrelationId } from '../context/cls';

/**
 * `nestjs-pino`-backed logger (Q6 Bundle A):
 *   - JSON output in production, `pino-pretty` transport in dev.
 *   - Level from `API_LOG_LEVEL` with per-environment defaults.
 *   - `correlation_id` attached to every log line via the CLS store
 *     shared with transactions (ADR 0021, Q6). Same value is echoed on
 *     the `X-Correlation-Id` response header — see
 *     `correlation-id-interceptor.ts`.
 *   - Authorization / cookie headers redacted at pino level.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ClsService],
      useFactory: (cls: ClsService<AppClsStore>) => {
        const env = loadEnv();
        const level = resolveLogLevel(env);
        const isDev = env.NODE_ENV === 'development';
        return {
          pinoHttp: {
            level,
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: false, colorize: true },
                  },
                }
              : {}),
            genReqId: (req: IncomingMessage) => resolveCorrelationId(req),
            customProps: () => {
              const id = cls.get('correlationId');
              return id !== undefined ? { correlation_id: id } : {};
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
              remove: false,
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
