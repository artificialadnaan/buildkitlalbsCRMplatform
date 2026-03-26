import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { contacts } from './contacts.js';
import { emailTemplates } from './email-templates.js';
import { users } from './users.js';

export const emailSendStatusEnum = pgEnum('email_send_status', ['queued', 'sent', 'failed']);

export const emailSends = pgTable('email_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id),
  templateId: uuid('template_id').references(() => emailTemplates.id),
  sentBy: uuid('sent_by').notNull().references(() => users.id),
  subject: varchar('subject', { length: 500 }),
  bodyHtml: varchar('body_html'),
  gmailMessageId: varchar('gmail_message_id', { length: 255 }),
  gmailThreadId: varchar('gmail_thread_id', { length: 255 }),
  status: emailSendStatusEnum('status').notNull().default('queued'),
  errorMessage: varchar('error_message', { length: 1000 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
