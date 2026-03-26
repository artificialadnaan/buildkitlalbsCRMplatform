import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { portalUsers } from './portal-users.js';
import { tasks } from './tasks.js';

export const changeRequestStatusEnum = pgEnum('change_request_status', [
  'submitted', 'reviewed', 'approved', 'rejected', 'completed',
]);

export const changeRequestPriorityEnum = pgEnum('change_request_priority', ['low', 'medium', 'high']);

export const changeRequests = pgTable('change_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  portalUserId: uuid('portal_user_id').notNull().references(() => portalUsers.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  priority: changeRequestPriorityEnum('priority').notNull().default('medium'),
  status: changeRequestStatusEnum('status').notNull().default('submitted'),
  taskId: uuid('task_id').references(() => tasks.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});
