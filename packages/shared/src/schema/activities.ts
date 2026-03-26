import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { contacts } from './contacts.js';
import { users } from './users.js';

export const activityTypeEnum = pgEnum('activity_type', ['email', 'call', 'text', 'note', 'meeting']);

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: activityTypeEnum('type').notNull(),
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  gmailThreadId: varchar('gmail_thread_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
