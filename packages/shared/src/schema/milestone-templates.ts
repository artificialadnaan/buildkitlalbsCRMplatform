import { pgTable, uuid, varchar, integer } from 'drizzle-orm/pg-core';

// Reuse projectTypeEnum from projects.ts — reference it, don't recreate
import { projectTypeEnum } from './projects.js';

export const milestoneTemplates = pgTable('milestone_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  projectType: projectTypeEnum('project_type').notNull(),
});

export const milestoneTemplateItems = pgTable('milestone_template_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => milestoneTemplates.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  position: integer('position').notNull(),
});
