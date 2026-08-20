import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { ClsStore } from 'nestjs-cls';

/**
 * Single request-scoped AsyncLocalStorage store (per ADR 0021 + Q6).
 * Carries the correlation ID today; transactions (Commit 4) and
 * resolved administrator identity (Commit 5) attach here too — one
 * store, multiple concerns, no parallel context stacks.
 *
 * Extends nestjs-cls's `ClsStore` (which requires an internal symbol
 * index signature) so `ClsService<AppClsStore>` is type-compatible.
 */
export interface AppClsStore extends ClsStore {
  /**
   * Set by the ClsMiddleware on every request. Optional at the type
   * level because logger `customProps` and other callbacks can fire
   * outside a request scope (bootstrap logs, background jobs).
   * Consumers inside request handlers can rely on it being defined.
   */
  correlationId?: string;
  administrator?: {
    id: string;
    email: string;
    displayName: string;
  };
  /** Owned and interpreted only by DatabaseService/UnitOfWork. */
  databaseTransaction?: unknown;
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_REQUEST_KEY = Symbol('correlationId');

type CorrelatedRequest = IncomingMessage & {
  [CORRELATION_ID_REQUEST_KEY]?: string;
};

/**
 * Pull a valid non-empty correlation ID out of a header value that may
 * arrive as a string, a string array, or be missing entirely. Kept as
 * a single helper so header parsing has one implementation across the
 * middleware and the logger.
 */
export function firstNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.length > 0) return item;
    }
  }
  return undefined;
}

/** Resolve once even when Pino and CLS observe the request in either order. */
export function resolveCorrelationId(request: IncomingMessage): string {
  const correlatedRequest = request as CorrelatedRequest;
  const existing = correlatedRequest[CORRELATION_ID_REQUEST_KEY];
  if (existing !== undefined) return existing;

  const correlationId = firstNonEmptyString(request.headers[CORRELATION_ID_HEADER]) ?? randomUUID();
  correlatedRequest[CORRELATION_ID_REQUEST_KEY] = correlationId;
  return correlationId;
}
