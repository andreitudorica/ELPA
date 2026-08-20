import { z } from 'zod';

/**
 * Zod schema validated once at boot (see main.ts). Missing or malformed
 * values fail-fast before Nest bootstraps — no silent defaults in
 * production. Kept intentionally small; each Phase A commit that
 * introduces new configuration extends this schema.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  API_HOST: z.string().min(1),
  API_PORT: z.coerce.number().int().positive(),
  API_BASE_URL: z.url(),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
