import { pgTable, uuid, varchar, boolean, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const reportFrequencyEnum = pgEnum('report_frequency', ['weekly', 'monthly']);
export const reportTypeEnum = pgEnum('report_type', ['client_monthly', 'sales_performance', 'roi']);

export const reportSchedules = pgTable('report_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  frequency: reportFrequencyEnum('frequency').notNull().default('monthly'),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const generatedReports = pgTable('generated_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id),
  type: reportTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }),
  data: jsonb('data'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});
