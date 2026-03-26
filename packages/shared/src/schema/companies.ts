import { pgTable, uuid, varchar, integer, numeric, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';

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
  websiteAudit: jsonb('website_audit'),
  websiteScore: integer('website_score').default(0),
  websiteAuditedAt: timestamp('website_audited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
