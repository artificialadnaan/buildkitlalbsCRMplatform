import { Router } from 'express';
import { eq, ilike, sql, and } from 'drizzle-orm';
import { db, companies } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import type { CompanyType } from '@buildkit/shared';

const router = Router();

router.use(authMiddleware);

// List companies with pagination, search, and filter
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const type = req.query.type as CompanyType | undefined;

  const conditions = [];
  if (search) conditions.push(ilike(companies.name, `%${search}%`));
  if (type) conditions.push(eq(companies.type, type));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(companies).where(where).limit(limit).offset(offset).orderBy(companies.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(companies).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single company
router.get('/:id', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json(company);
});

// Create company
router.post('/', async (req, res) => {
  const [company] = await db.insert(companies).values(req.body).returning();
  res.status(201).json(company);
});

// Update company
router.patch('/:id', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db.update(companies)
    .set(req.body)
    .where(eq(companies.id, id))
    .returning();

  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json(company);
});

// Delete company (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = req.params.id as string;
  const [deleted] = await db.delete(companies).where(eq(companies.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
