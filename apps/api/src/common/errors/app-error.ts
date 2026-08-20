/**
 * Typed error hierarchy (ADR 0022 + Q6 Bundle B).
 *
 * Services throw concrete `AppError` subclasses. `AppExceptionFilter`
 * maps them to RFC 7807 `application/problem+json` responses. Adding a
 * new subclass forces a matching case in the filter's exhaustive switch
 * (`assertNever`) — a new error kind that skips the filter is a
 * TypeScript compile error, not a runtime surprise.
 *
 * Design notes:
 * - `kind` is the discriminant for exhaustive matching (string literal).
 * - `status`, `title`, `code` live on the class so the filter reads them
 *   directly instead of re-deriving from the subtype.
 * - `details` is an opaque bag for structured extras (never returned in
 *   the response body without an explicit filter case).
 * - `cause` uses the standard `Error.cause` chain.
 */

export interface AppErrorOptions {
  readonly details?: unknown;
  readonly cause?: unknown;
}

export abstract class AppError extends Error {
  abstract readonly kind: string;
  abstract readonly status: number;
  abstract readonly title: string;
  abstract readonly code: string;
  readonly details: unknown;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.details = options?.details;
  }
}

export class NotFoundError extends AppError {
  readonly kind = 'not_found' as const;
  readonly status = 404;
  readonly title = 'Not Found';
  readonly code = 'domain.not_found';
}

export class ConflictError extends AppError {
  readonly kind = 'conflict' as const;
  readonly status = 409;
  readonly title = 'Conflict';
  readonly code = 'domain.conflict';
}

export class PreconditionError extends AppError {
  readonly kind = 'precondition' as const;
  readonly status = 400;
  readonly title = 'Precondition Failed';
  readonly code = 'domain.precondition_failed';
}

export interface FieldIssue {
  path: (string | number)[];
  code: string;
  message: string;
}

export class ValidationError extends AppError {
  readonly kind = 'validation' as const;
  readonly status = 400;
  readonly title = 'Validation Failed';
  readonly code = 'validation.invalid';
  readonly fieldErrors: readonly FieldIssue[];

  constructor(message: string, fieldErrors: readonly FieldIssue[], options?: AppErrorOptions) {
    super(message, options);
    this.fieldErrors = fieldErrors;
  }
}

export class AuthenticationError extends AppError {
  readonly kind = 'authentication' as const;
  readonly status = 401;
  readonly title = 'Unauthenticated';
  readonly code = 'auth.unauthenticated';
}

export class AuthorizationError extends AppError {
  readonly kind = 'authorization' as const;
  readonly status = 403;
  readonly title = 'Forbidden';
  readonly code = 'auth.forbidden';
}

export class ExternalError extends AppError {
  readonly kind = 'external' as const;
  readonly status = 502;
  readonly title = 'Upstream Failure';
  readonly code = 'external.upstream_failure';
}

/**
 * Discriminated union over concrete subclasses. Used by the filter's
 * exhaustive switch — any new subclass must be added here AND handled
 * in the filter, or TypeScript refuses to compile.
 */
export type AnyAppError =
  | NotFoundError
  | ConflictError
  | PreconditionError
  | ValidationError
  | AuthenticationError
  | AuthorizationError
  | ExternalError;

export function assertNever(x: never): never {
  throw new Error(`Unhandled AppError variant reached exhaustive switch: ${JSON.stringify(x)}`);
}
