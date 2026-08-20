import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestampColumns } from '../database/timestamps';

export const administrators = pgTable(
  'administrator',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull().default('Administrator'),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('administrator_email_unique').on(table.email),
    check('administrator_role_check', sql`${table.role} = 'Administrator'`),
  ],
);
