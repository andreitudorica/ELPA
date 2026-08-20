import { describe, expect, it } from 'vitest';

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ExternalError,
  NotFoundError,
  PreconditionError,
  ValidationError,
  assertNever,
  type AnyAppError,
} from './app-error';

describe('AppError hierarchy', () => {
  it('each subtype exposes discriminant, status, title, and code', () => {
    const cases: { err: AnyAppError; status: number; kind: string }[] = [
      { err: new NotFoundError('missing'), status: 404, kind: 'not_found' },
      { err: new ConflictError('dup'), status: 409, kind: 'conflict' },
      { err: new PreconditionError('bad state'), status: 400, kind: 'precondition' },
      {
        err: new ValidationError('bad body', [
          { path: ['name'], code: 'required', message: 'is required' },
        ]),
        status: 400,
        kind: 'validation',
      },
      { err: new AuthenticationError('nope'), status: 401, kind: 'authentication' },
      { err: new AuthorizationError('nope'), status: 403, kind: 'authorization' },
      { err: new ExternalError('upstream'), status: 502, kind: 'external' },
    ];

    for (const { err, status, kind } of cases) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.kind).toBe(kind);
      expect(err.status).toBe(status);
      expect(err.title.length).toBeGreaterThan(0);
      expect(err.code.length).toBeGreaterThan(0);
    }
  });

  it('preserves cause chain via Error.cause', () => {
    const root = new Error('root failure');
    const wrapped = new ExternalError('upstream failed', { cause: root });
    expect(wrapped.cause).toBe(root);
  });

  it('exposes structured field errors on ValidationError', () => {
    const err = new ValidationError('bad body', [
      { path: ['offer', 'name'], code: 'required', message: 'is required' },
      { path: ['offer', 'sleeps'], code: 'invalid_type', message: 'must be int' },
    ]);
    expect(err.fieldErrors).toHaveLength(2);
    expect(err.fieldErrors[0]?.path).toEqual(['offer', 'name']);
  });

  it('assertNever throws when reached at runtime', () => {
    // Simulating "someone extended AnyAppError but forgot the filter case".
    const rogue = { kind: 'rogue' } as unknown as never;
    expect(() => assertNever(rogue)).toThrow(/Unhandled AppError variant/);
  });
});
