import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type AppDatabase = NodePgDatabase;
export type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
