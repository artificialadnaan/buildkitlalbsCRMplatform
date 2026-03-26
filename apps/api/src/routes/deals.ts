import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, deals, companies, contacts, pipelineStages } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// List deals with filters and joined metadata
router.get('/', async (req, res) => {
  const { pipelineId, status, assignedTo } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (pipelineId) conditions.push(eq(deals.pipelineId, pipelineId as string));
  if (status) conditions.push(eq(deals.status, status as 'open' | 'won' | 'lost'));
  if (assignedTo) conditions.push(eq(deals.assignedTo, assignedTo as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      deal: deals,
      companyName: companies.name,
      contactName: contacts.firstName,
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      stagePosition: pipelineStages.position,
    })
      .from(deals)
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(deals.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(deals).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single deal with joined metadata
router.get('/:id', async (req, res) => {
  const [result] = await db.select({
    deal: deals,
    companyName: companies.name,
    contactName: contacts.firstName,
    contactEmail: contacts.email,
    stageName: pipelineStages.name,
  })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(eq(deals.id, req.params.id as string))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  res.json(result);
});

// Create deal
router.post('/', async (req, res) => {
  const [deal] = await db.insert(deals).values({
    ...req.body,
    assignedTo: req.body.assignedTo || req.user!.userId,
  }).returning();
  res.status(201).json(deal);
});

// Update deal — auto-sets closedAt when status changes to won/lost
router.patch('/:id', async (req, res) => {
  const updates = { ...req.body };
  if (updates.status === 'won' || updates.status === 'lost') {
    updates.closedAt = new Date();
  }
  const [deal] = await db.update(deals).set(updates).where(eq(deals.id, req.params.id as string)).returning();
  if (!deal) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  res.json(deal);
});

// Move deal to a different stage (drag-and-drop support)
router.patch('/:id/stage', async (req, res) => {
  const { stageId } = req.body;
  const [deal] = await db.update(deals).set({ stageId }).where(eq(deals.id, req.params.id as string)).returning();
  if (!deal) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  res.json(deal);
});

// Delete deal
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(deals).where(eq(deals.id, req.params.id as string)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
