import { pgTable, uuid, varchar, integer, date, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const milestoneStatusEnum = pgEnum('milestone_status', ['pending', 'in_progress', 'done']);

export const milestones = pgTable('milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  dueDate: date('due_date'),
  status: milestoneStatusEnum('status').notNull().default('pending'),
  position: integer('position').notNull(),
});
