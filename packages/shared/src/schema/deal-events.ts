import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { users } from './users.js';

export const dealEventTypeEnum = pgEnum('deal_event_type', [
  'stage_change', 'status_change', 'sms_sent', 'call_made', 'note_added', 'email_sent',
]);

export const dealEvents = pgTable('deal_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  type: dealEventTypeEnum('type').notNull(),
  fromValue: varchar('from_value', { length: 255 }),
  toValue: varchar('to_value', { length: 255 }),
  userId: uuid('user_id').references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
