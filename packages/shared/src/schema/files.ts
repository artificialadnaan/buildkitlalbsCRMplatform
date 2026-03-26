import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').notNull(),
  filename: varchar('filename', { length: 500 }).notNull(),
  r2Key: varchar('r2_key', { length: 1000 }).notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
