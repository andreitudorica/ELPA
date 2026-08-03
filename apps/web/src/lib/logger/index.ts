import { env } from '@/lib/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Readonly<Record<string, unknown>>;

export interface LoggerTransport {
  log: (level: LogLevel, message: string, context?: LogContext, error?: unknown) => void;
}

/**
 * Console transport used by default. Replace it with a monitoring provider
 * (e.g. Sentry) via `setLoggerTransport` during application bootstrap:
 *
 *   setLoggerTransport({
 *     log: (level, message, context, error) => Sentry.captureMessage(...)
 *   })
 *
 * Safe-logging rules: never log credentials, tokens, or personal data.
 * Pass structured context instead of interpolating values into messages.
 */
const consoleTransport: LoggerTransport = {
  log(level, message, context, error) {
    if (env.PROD && level === 'debug') {
      return;
    }
    const method = level === 'debug' ? 'info' : level;
    const parts: unknown[] = [`[${level.toUpperCase()}] ${message}`];
    if (context !== undefined) {
      parts.push(context);
    }
    if (error !== undefined) {
      parts.push(error);
    }

    console[method](...parts);
  },
};

let transport: LoggerTransport = consoleTransport;

export function setLoggerTransport(next: LoggerTransport): void {
  transport = next;
}

export function resetLoggerTransport(): void {
  transport = consoleTransport;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    transport.log('debug', message, context);
  },
  info: (message: string, context?: LogContext) => {
    transport.log('info', message, context);
  },
  warn: (message: string, context?: LogContext) => {
    transport.log('warn', message, context);
  },
  error: (message: string, error?: unknown, context?: LogContext) => {
    transport.log('error', message, context, error);
  },
};
