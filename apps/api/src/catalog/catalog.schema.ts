import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestampColumns } from '../database/timestamps';

export const categories = pgTable(
  'category',
  {
    id: uuid('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex('category_key_unique').on(table.key)],
);
