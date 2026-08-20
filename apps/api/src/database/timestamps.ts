import { timestamp } from 'drizzle-orm/pg-core';

/** Shared ADR 0021 timestamp columns; returns fresh column instances per table. */
export function timestampColumns() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  };
}
