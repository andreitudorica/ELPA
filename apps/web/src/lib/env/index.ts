import { z } from 'zod';

/**
 * All variables read from `import.meta.env` are validated here, once, at startup.
 * Never add secrets: every VITE_-prefixed value ships inside the public bundle.
 * Do not add identity or authentication variables here — identity is server-side
 * (see ADR 0009/0010 and `src/lib/identity`).
 */
const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  MODE: z.enum(['development', 'test', 'production']).catch('production'),
  DEV: z.boolean(),
  PROD: z.boolean(),

  /**
   * Semantic deploy tier. `development` is local, `test` is Vitest, `alpha` is
   * an infrastructure-protected private deployment permitted to use simulated
   * identity (ADR 0010), `production` is any public deployment where
   * simulation must be inert.
   */
  VITE_APP_ENV: z.enum(['development', 'test', 'alpha', 'production']).default('production'),

  VITE_API_BASE_URL: z.string().min(1, 'VITE_API_BASE_URL is required'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  /** Default UI locale on first visit; user preference overrides afterwards. */
  VITE_DEFAULT_LOCALE: z.enum(['ro', 'en']).default('ro'),

  /**
   * MSW as a dev/test mock backend (ADR 0016). `main.tsx` also checks
   * `VITE_APP_ENV !== 'production'` so a production build cannot boot the
   * worker even if this flag is misconfigured.
   */
  VITE_ENABLE_MOCKS: booleanFlag,

  /** Show TanStack Query/Router devtools. Ignored in production builds. */
  VITE_ENABLE_DEVTOOLS: booleanFlag,
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  return result.data;
}

/** Validated environment. Importing this module fails fast on invalid configuration. */
export const env: Env = parseEnv(import.meta.env);
