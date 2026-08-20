import { type z } from 'zod';

import { env } from '@/lib/env';

import { ApiError, apiErrorFromResponse, normalizeError } from './errors';

type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions<TResponse> {
  /** Path relative to the API base URL, e.g. `/users`. */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Query parameters; `undefined` values are omitted. */
  query?: Record<string, QueryValue>;
  /** JSON body. Use `formData` for uploads. */
  body?: unknown;
  /** Multipart body for file uploads; takes precedence over `body`. */
  formData?: FormData;
  /**
   * Zod schema applied to the response body. Use it at important trust
   * boundaries; when omitted the caller's type parameter is trusted.
   */
  schema?: z.ZodType<TResponse>;
  /** Abort signal for request cancellation (TanStack Query passes one per query). */
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * The auth feature registers a token getter here. Registration (instead of a
 * direct import) keeps `lib/` free of feature dependencies and avoids cycles.
 */
type TokenProvider = () => string | undefined;
let tokenProvider: TokenProvider = () => undefined;

export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/** Called on every 401 response, e.g. to clear the session and redirect to login. */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = env.VITE_API_BASE_URL.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function combineSignals(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }
  return (await response.json()) as unknown;
}

/**
 * Typed `fetch` wrapper used by all feature API modules.
 * Every failure is thrown as a normalized {@link ApiError}.
 */
export async function apiRequest<TResponse>(
  options: ApiRequestOptions<TResponse>,
): Promise<TResponse> {
  const {
    path,
    method = 'GET',
    query,
    body,
    formData,
    schema,
    signal,
    timeoutMs = env.VITE_API_TIMEOUT_MS,
    headers = {},
  } = options;

  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  const token = tokenProvider();
  if (token !== undefined) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (formData !== undefined) {
    requestBody = formData; // The browser sets the multipart boundary header itself.
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      ...(requestBody !== undefined ? { body: requestBody } : {}),
      signal: combineSignals(timeoutMs, signal),
    });

    const responseBody = await parseJsonBody(response);

    if (!response.ok) {
      if (response.status === 401) {
        unauthorizedHandler?.();
      }
      throw apiErrorFromResponse(response.status, responseBody);
    }

    if (schema) {
      return schema.parse(responseBody);
    }
    return responseBody as TResponse;
  } catch (error) {
    throw normalizeError(error);
  }
}

type WithoutMethodAndPath<T> = Omit<ApiRequestOptions<T>, 'method' | 'path'>;

export const api = {
  get: <T>(path: string, options: WithoutMethodAndPath<T> = {}) =>
    apiRequest<T>({ ...options, path, method: 'GET' }),
  post: <T>(path: string, options: WithoutMethodAndPath<T> = {}) =>
    apiRequest<T>({ ...options, path, method: 'POST' }),
  put: <T>(path: string, options: WithoutMethodAndPath<T> = {}) =>
    apiRequest<T>({ ...options, path, method: 'PUT' }),
  patch: <T>(path: string, options: WithoutMethodAndPath<T> = {}) =>
    apiRequest<T>({ ...options, path, method: 'PATCH' }),
  delete: <T>(path: string, options: WithoutMethodAndPath<T> = {}) =>
    apiRequest<T>({ ...options, path, method: 'DELETE' }),
  /** File-upload helper: `api.upload('/users/42/avatar', file)`. */
  upload: <T>(path: string, file: File, options: WithoutMethodAndPath<T> = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<T>({ ...options, path, method: 'POST', formData });
  },
};

export { ApiError };
