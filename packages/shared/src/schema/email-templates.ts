import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const pipelineTypeEnum = pgEnum('pipeline_type', ['local', 'construction']);

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  bodyHtml: text('body_html').notNull(),
  pipelineType: pipelineTypeEnum('pipeline_type').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
