import { pgTable, uuid, text, integer, date, boolean, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull(),
  date: date('date').notNull(),
  billable: boolean('billable').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
