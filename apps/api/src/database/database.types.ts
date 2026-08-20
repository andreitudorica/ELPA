import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../drizzle/schema';

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
