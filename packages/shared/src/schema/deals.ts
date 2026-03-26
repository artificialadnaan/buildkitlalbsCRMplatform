import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { contacts } from './contacts.js';
import { users } from './users.js';
import { pipelines, pipelineStages } from './pipelines.js';

export const dealStatusEnum = pgEnum('deal_status', ['open', 'won', 'lost']);

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  pipelineId: uuid('pipeline_id').notNull().references(() => pipelines.id),
  stageId: uuid('stage_id').notNull().references(() => pipelineStages.id),
  title: varchar('title', { length: 255 }).notNull(),
  value: integer('value'),
  status: dealStatusEnum('status').notNull().default('open'),
  lostReason: varchar('lost_reason', { length: 500 }),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
