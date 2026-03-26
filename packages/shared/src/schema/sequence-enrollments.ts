import { pgTable, uuid, integer, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { contacts } from './contacts.js';
import { emailSequences } from './email-sequences.js';
import { users } from './users.js';

export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'paused', 'completed', 'cancelled']);
export const pausedReasonEnum = pgEnum('paused_reason', ['reply_received', 'manual']);

export const sequenceEnrollments = pgTable('sequence_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  sequenceId: uuid('sequence_id').notNull().references(() => emailSequences.id),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  currentStep: integer('current_step').notNull().default(1),
  status: enrollmentStatusEnum('status').notNull().default('active'),
  pausedReason: pausedReasonEnum('paused_reason'),
  nextSendAt: timestamp('next_send_at', { withTimezone: true }),
  enrolledBy: uuid('enrolled_by').references(() => users.id),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
});
