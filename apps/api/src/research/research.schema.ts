import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { administrators } from '../access/access.schema';
import { categories } from '../catalog/catalog.schema';
import { timestampColumns } from '../database/timestamps';

export const researchCampaigns = pgTable(
  'research_campaign',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    eventNeed: text('event_need').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    countryCode: text('country_code').notNull().default('RO'),
    county: text('county').notNull(),
    locality: text('locality'),
    minimumCriteria: text('minimum_criteria')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdByAdministratorId: uuid('created_by_administrator_id')
      .notNull()
      .references(() => administrators.id, { onDelete: 'restrict' }),
    ...timestampColumns(),
  },
  (table) => [
    index('research_campaign_created_at_index').on(table.createdAt),
    check('research_campaign_country_check', sql`${table.countryCode} = 'RO'`),
  ],
);

export const researchCampaignSources = pgTable(
  'research_campaign_source',
  {
    id: uuid('id').primaryKey(),
    researchCampaignId: uuid('research_campaign_id')
      .notNull()
      .references(() => researchCampaigns.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('research_campaign_source_campaign_url_unique').on(
      table.researchCampaignId,
      table.url,
    ),
    index('research_campaign_source_campaign_index').on(table.researchCampaignId),
  ],
);
