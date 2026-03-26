import { pgTable, uuid, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { milestones } from './milestones.js';
import { portalUsers } from './portal-users.js';

export const satisfactionSurveys = pgTable('satisfaction_surveys', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  milestoneId: uuid('milestone_id').notNull().references(() => milestones.id),
  portalUserId: uuid('portal_user_id').notNull().references(() => portalUsers.id),
  rating: integer('rating'),
  comment: text('comment'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});
