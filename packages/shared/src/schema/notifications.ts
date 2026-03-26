import { pgTable, uuid, varchar, text, boolean, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationTypeEnum = pgEnum('notification_type', [
  'stale_deal', 'hot_lead', 'sequence_digest', 'task_due',
  'milestone_completed', 'reply_received', 'campaign_update',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  staleDealDays: integer('stale_deal_days').notNull().default(7),
  hotLeadOpens: integer('hot_lead_opens').notNull().default(3),
  hotLeadWindowHours: integer('hot_lead_window_hours').notNull().default(1),
  dailyDigestEnabled: boolean('daily_digest_enabled').notNull().default(true),
  digestSendHour: integer('digest_send_hour').notNull().default(9),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
