import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { scrapeJobs } from './scrape-jobs.js';
import { emailSequences } from './email-sequences.js';

export const campaignStatusEnum = pgEnum('campaign_status', [
  'scraping', 'auditing', 'scoring', 'enrolling', 'active', 'completed', 'failed', 'cancelled',
]);

export const outreachCampaigns = pgTable('outreach_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  scrapeJobId: uuid('scrape_job_id').references(() => scrapeJobs.id),
  sequenceId: uuid('sequence_id').references(() => emailSequences.id),
  zipCodes: text('zip_codes').array().notNull(),
  searchQuery: varchar('search_query', { length: 255 }).notNull(),
  topN: integer('top_n').notNull().default(100),
  minScore: integer('min_score').notNull().default(0),
  status: campaignStatusEnum('status').notNull().default('scraping'),
  stats: jsonb('stats').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
