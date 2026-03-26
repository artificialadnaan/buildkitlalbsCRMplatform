import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  title: varchar('title', { length: 100 }),
  isPrimary: boolean('is_primary').notNull().default(false),
  linkedinUrl: varchar('linkedin_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
