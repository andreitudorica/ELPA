import { delay } from 'msw';

/**
 * Simulated network latency so loading states are visible during development.
 * `delay(0)` in tests keeps them fast; MSW also skips real timers in Node.
 */
export async function networkDelay(): Promise<void> {
  if (import.meta.env.MODE === 'test') {
    await delay(0);
    return;
  }
  await delay(Math.floor(Math.random() * 300) + 150);
}

/** Prefixes a path with the API base URL used by the app. */
export function apiPath(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  return `${base.replace(/\/$/, '')}${path}`;
}
