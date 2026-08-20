import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { administrators } from '../access/access.schema';
import { timestampColumns } from '../database/timestamps';

export const auditEvents = pgTable('audit_event', {
  id: uuid('id').primaryKey(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  administratorId: uuid('administrator_id')
    .notNull()
    .references(() => administrators.id, { onDelete: 'restrict' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  ...timestampColumns(),
});
