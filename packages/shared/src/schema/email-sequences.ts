import { pgTable, uuid, varchar, integer, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';
import { pipelineTypeEnum } from './email-templates.js';
import { emailTemplates } from './email-templates.js';

export const sequenceStepChannelEnum = pgEnum('sequence_step_channel', ['email', 'sms']);

export const emailSequences = pgTable('email_sequences', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  pipelineType: pipelineTypeEnum('pipeline_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceSteps = pgTable('sequence_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  sequenceId: uuid('sequence_id').notNull().references(() => emailSequences.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => emailTemplates.id),
  stepNumber: integer('step_number').notNull(),
  delayDays: integer('delay_days').notNull().default(0),
  channel: sequenceStepChannelEnum('channel').notNull().default('email'),
  smsBody: text('sms_body'),
});
