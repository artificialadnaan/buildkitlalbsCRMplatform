import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { emailSends } from './email-sends.js';

export const emailEventTypeEnum = pgEnum('email_event_type', ['open', 'click']);

export const emailEvents = pgTable('email_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailSendId: uuid('email_send_id').notNull().references(() => emailSends.id, { onDelete: 'cascade' }),
  type: emailEventTypeEnum('type').notNull(),
  metadata: varchar('metadata', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
