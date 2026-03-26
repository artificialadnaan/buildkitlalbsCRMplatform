import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { contacts } from './contacts.js';
import { companies } from './companies.js';

export const portalUsers = pgTable('portal_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  email: varchar('email', { length: 255 }).notNull(),
  magicLinkToken: varchar('magic_link_token', { length: 255 }),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
