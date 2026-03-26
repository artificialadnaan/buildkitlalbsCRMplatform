import { pgTable, uuid, varchar, integer, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const scrapeJobStatusEnum = pgEnum('scrape_job_status', ['pending', 'running', 'done', 'failed']);

export const scrapeJobs = pgTable('scrape_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedBy: uuid('started_by').notNull().references(() => users.id),
  zipCodes: text('zip_codes').array().notNull(),
  searchQuery: varchar('search_query', { length: 255 }).notNull(),
  status: scrapeJobStatusEnum('status').notNull().default('pending'),
  totalFound: integer('total_found').default(0),
  newLeads: integer('new_leads').default(0),
  duplicatesSkipped: integer('duplicates_skipped').default(0),
  errorMessage: varchar('error_message', { length: 1000 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
