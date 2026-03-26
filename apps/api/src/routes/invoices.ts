import { Router } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, invoices, projects, companies, timeEntries } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import type { LineItem } from '@buildkit/shared';

const router = Router();

router.use(authMiddleware);

// Generate invoice number (INV-YYYYMM-XXX)
async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [result] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(invoices);

  const seq = String(result.count + 1).padStart(3, '0');
  return `${prefix}-${seq}`;
}

// Calculate total from line items
function calculateTotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPriceCents), 0);
}

// Get unbilled time entries for a project (must be before /:id route)
router.get('/unbilled-time', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  const entries = await db.select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.projectId, projectId),
        eq(timeEntries.billable, true)
      )
    );

  res.json(entries);
});

// List invoices with optional filters
router.get('/', async (req, res) => {
  const { projectId, status, companyId } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (projectId) conditions.push(eq(invoices.projectId, projectId as string));
  if (status) conditions.push(eq(invoices.status, status as 'draft' | 'sent' | 'paid' | 'overdue'));
  if (companyId) conditions.push(eq(invoices.companyId, companyId as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      invoice: invoices,
      projectName: projects.name,
      companyName: companies.name,
    })
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(invoices.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single invoice
router.get('/:id', async (req, res) => {
  const [result] = await db.select({
    invoice: invoices,
    projectName: projects.name,
    companyName: companies.name,
  })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .where(eq(invoices.id, req.params.id))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  // Flatten for convenience
  res.json({ ...result.invoice, projectName: result.projectName, companyName: result.companyName });
});

// Create invoice
router.post('/', async (req, res) => {
  const { projectId, dueDate, lineItems } = req.body;

  if (!projectId || !dueDate || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    res.status(400).json({ error: 'projectId, dueDate, and lineItems are required' });
    return;
  }

  // Get project's company_id
  const [project] = await db.select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const invoiceNumber = await generateInvoiceNumber();
  const amountCents = calculateTotal(lineItems);

  const [invoice] = await db.insert(invoices).values({
    projectId,
    companyId: project.companyId,
    invoiceNumber,
    amountCents,
    status: 'draft',
    dueDate: typeof dueDate === 'string' ? dueDate : new Date(dueDate).toISOString().split('T')[0],
    lineItems,
  }).returning();

  res.status(201).json(invoice);
});

// Update draft invoice
router.patch('/:id', async (req, res) => {
  // Check current status
  const [existing] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, req.params.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (existing.status !== 'draft') {
    res.status(400).json({ error: 'Only draft invoices can be edited' });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (req.body.dueDate) {
    updates.dueDate = new Date(req.body.dueDate);
  }

  if (req.body.lineItems) {
    updates.lineItems = req.body.lineItems;
    updates.amountCents = calculateTotal(req.body.lineItems);
  }

  const [invoice] = await db.update(invoices)
    .set(updates)
    .where(eq(invoices.id, req.params.id))
    .returning();

  res.json(invoice);
});

// Delete draft invoice
router.delete('/:id', async (req, res) => {
  const [existing] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, req.params.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (existing.status !== 'draft') {
    res.status(400).json({ error: 'Only draft invoices can be deleted' });
    return;
  }

  await db.delete(invoices).where(eq(invoices.id, req.params.id));
  res.json({ success: true });
});

export default router;
