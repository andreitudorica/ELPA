import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

let environmentFilesLoaded = false;
let cachedProcessEnv: Env | undefined;

function loadEnvironmentFiles(): void {
  if (environmentFilesLoaded) return;
  loadDotenv({ path: ['.env.local', '.env'], quiet: true });
  environmentFilesLoaded = true;
}

/**
 * Zod schema validated once at boot (see main.ts). Missing or malformed
 * values fail-fast before Nest bootstraps — no silent defaults in
 * production. Kept intentionally small; each Phase A commit that
 * introduces new configuration extends this schema.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    API_HOST: z.string().min(1),
    API_PORT: z.coerce.number().int().positive(),
    API_BASE_URL: z.url(),
    API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
    API_DEPLOYMENT_VISIBILITY: z.enum(['local', 'private', 'public']),
    API_SIMULATED_ADMINISTRATOR_EMAIL: z.email().optional(),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL URL'),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  })
  .superRefine((env, ctx) => {
    if (
      env.API_SIMULATED_ADMINISTRATOR_EMAIL !== undefined &&
      env.API_DEPLOYMENT_VISIBILITY === 'public'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['API_SIMULATED_ADMINISTRATOR_EMAIL'],
        message: 'Simulated authentication is forbidden in public environments',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export type LogLevel = NonNullable<Env['API_LOG_LEVEL']>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) {
    loadEnvironmentFiles();
    if (cachedProcessEnv !== undefined) return cachedProcessEnv;
  }

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (source === process.env) cachedProcessEnv = parsed.data;
  return parsed.data;
}

/**
 * Resolve the effective log level. Falls back to sensible defaults per
 * environment so operators do not have to set this for the common case.
 */
export function resolveLogLevel(env: Env): LogLevel {
  if (env.API_LOG_LEVEL !== undefined) return env.API_LOG_LEVEL;
  switch (env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'warn';
    case 'development':
      return 'debug';
  }
}
