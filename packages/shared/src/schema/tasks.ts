import { pgTable, uuid, varchar, text, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { milestones } from './milestones.js';
import { users } from './users.js';

export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  milestoneId: uuid('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  assignedTo: uuid('assigned_to').references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
