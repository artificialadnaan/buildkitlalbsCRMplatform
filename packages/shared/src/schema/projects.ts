import { pgTable, uuid, varchar, integer, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { companies } from './companies.js';
import { users } from './users.js';

export const projectTypeEnum = pgEnum('project_type', ['website', 'software']);
export const projectStatusEnum = pgEnum('project_status', ['active', 'on_hold', 'completed']);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').references(() => deals.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: projectTypeEnum('type').notNull(),
  status: projectStatusEnum('status').notNull().default('active'),
  startDate: date('start_date'),
  targetLaunchDate: date('target_launch_date'),
  budget: integer('budget'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
