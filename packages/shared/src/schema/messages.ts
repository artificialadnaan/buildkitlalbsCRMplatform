import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const senderTypeEnum = pgEnum('sender_type', ['team', 'client']);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  senderType: senderTypeEnum('sender_type').notNull(),
  senderId: uuid('sender_id').notNull(),
  body: text('body').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
