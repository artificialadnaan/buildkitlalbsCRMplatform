import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, contacts } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// List contacts with optional companyId filter and pagination
router.get('/', async (req, res) => {
  const companyId = req.query.companyId as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const where = companyId ? eq(contacts.companyId, companyId) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(contacts).where(where).limit(limit).offset(offset).orderBy(contacts.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single contact
router.get('/:id', async (req, res) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, req.params.id as string)).limit(1);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  res.json(contact);
});

// Create contact
router.post('/', async (req, res) => {
  const [contact] = await db.insert(contacts).values(req.body).returning();
  res.status(201).json(contact);
});

// Update contact
router.patch('/:id', async (req, res) => {
  const [contact] = await db.update(contacts).set(req.body).where(eq(contacts.id, req.params.id as string)).returning();
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  res.json(contact);
});

// Delete contact
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(contacts).where(eq(contacts.id, req.params.id as string)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
