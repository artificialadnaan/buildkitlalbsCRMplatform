import { pgTable, uuid, varchar, integer, timestamp, date, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { companies } from './companies.js';

export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue']);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  amountCents: integer('amount_cents').notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  dueDate: date('due_date').notNull(),
  lineItems: jsonb('line_items').notNull().default([]),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  pdfR2Key: varchar('pdf_r2_key', { length: 1000 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
