import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { contacts } from './contacts.js';
import { deals } from './deals.js';

export const conversationChannelEnum = pgEnum('conversation_channel', ['email', 'sms', 'call', 'internal']);
export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageChannelEnum = pgEnum('message_channel', ['email', 'sms', 'call']);
export const messageStatusEnum = pgEnum('message_status', ['queued', 'sent', 'delivered', 'failed', 'received']);

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  channel: conversationChannelEnum('channel').notNull(),
  subject: varchar('subject', { length: 500 }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  direction: messageDirectionEnum('direction').notNull(),
  channel: messageChannelEnum('channel').notNull(),
  body: text('body').notNull(),
  senderName: varchar('sender_name', { length: 255 }),
  senderPhone: varchar('sender_phone', { length: 50 }),
  senderEmail: varchar('sender_email', { length: 255 }),
  twilioSid: varchar('twilio_sid', { length: 255 }),
  status: messageStatusEnum('status').notNull().default('queued'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
