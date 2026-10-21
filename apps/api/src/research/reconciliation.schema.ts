import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { administrators } from '../access/access.schema';
import { timestampColumns } from '../database/timestamps';
import { candidates } from './acquisition.schema';
import { researchCampaigns } from './research.schema';
import type { ReconciliationCase, ReconciliationResult } from './reconciliation/contracts';

/** Append-only experiment snapshots; no write path to Claims or canonical entities. */
export const reconciliationAssessments = pgTable(
  'reconciliation_assessment',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'restrict' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'restrict' }),
    ruleVersion: text('rule_version').notNull(),
    inputDigest: text('input_digest').notNull(),
    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('research_only'),
    input: jsonb('input').$type<ReconciliationCase>().notNull(),
    result: jsonb('result').$type<ReconciliationResult>().notNull(),
    initiatedByAdministratorId: uuid('initiated_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('reconciliation_assessment_campaign_input_unique').on(
      table.researchCampaignId,
      table.inputDigest,
      table.ruleVersion,
    ),
    index('reconciliation_assessment_candidate_index').on(table.candidateId, table.assessedAt),
    check('reconciliation_assessment_status_check', sql`${table.status} = 'research_only'`),
  ],
);
