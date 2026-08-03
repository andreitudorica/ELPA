import { z } from 'zod';

export type ApiErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'validation' | 'unexpected';

/** Field-level validation details, e.g. `{ email: ['Already taken'] }`. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  fieldErrors?: FieldErrors;
  cause?: unknown;
}

/**
 * The single error shape the rest of the app deals with. Every failure path of
 * the API client is normalized into an `ApiError` so UI code never needs to
 * inspect raw fetch/DOMException/Zod errors.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.fieldErrors = init.fieldErrors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Retrying only makes sense for transient failures. */
  get isRetryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      (this.status !== undefined && this.status >= 500)
    );
  }
}

/** Error payload convention used by the backend (and mirrored by MSW handlers). */
const errorBodySchema = z.object({
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(body);
  const message = parsed.success && parsed.data.message ? parsed.data.message : `Request failed`;
  const fieldErrors = parsed.success ? parsed.data.errors : undefined;
  return new ApiError({
    kind: 'http',
    message,
    status,
    ...(fieldErrors !== undefined ? { fieldErrors } : {}),
  });
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new ApiError({
      kind: 'validation',
      message: 'Received an unexpected response from the server.',
      cause: error,
    });
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new ApiError({ kind: 'timeout', message: 'The request timed out.', cause: error });
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({ kind: 'aborted', message: 'The request was cancelled.', cause: error });
  }
  if (error instanceof TypeError) {
    return new ApiError({
      kind: 'network',
      message: 'Could not reach the server. Check your connection.',
      cause: error,
    });
  }
  return new ApiError({
    kind: 'unexpected',
    message: error instanceof Error ? error.message : 'Something went wrong.',
    cause: error,
  });
}
