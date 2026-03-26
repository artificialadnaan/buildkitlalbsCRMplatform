import { pgTable, uuid, varchar, integer, numeric, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { scrapeJobs } from './scrape-jobs.js';
import { users } from './users.js';

export const companyTypeEnum = pgEnum('company_type', ['local', 'construction']);
export const companySourceEnum = pgEnum('company_source', ['scraped', 'manual']);

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: companyTypeEnum('type').notNull(),
  website: varchar('website', { length: 500 }),
  phone: varchar('phone', { length: 50 }),
  address: varchar('address', { length: 500 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  zip: varchar('zip', { length: 20 }),
  googlePlaceId: varchar('google_place_id', { length: 255 }).unique(),
  googleRating: numeric('google_rating', { precision: 2, scale: 1 }),
  industry: varchar('industry', { length: 100 }),
  employeeCount: integer('employee_count'),
  source: companySourceEnum('source').notNull().default('manual'),
  score: integer('score').notNull().default(0),
  scrapeJobId: uuid('scrape_job_id').references(() => scrapeJobs.id),
  websiteAudit: jsonb('website_audit'),
  websiteScore: integer('website_score').default(0),
  websiteAuditedAt: timestamp('website_audited_at', { withTimezone: true }),
  assignedTo: uuid('assigned_to').references(() => users.id),
  enrichmentStatus: varchar('enrichment_status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
