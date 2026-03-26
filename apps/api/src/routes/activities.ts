import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, activities } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// List activities with optional dealId filter
router.get('/', async (req, res) => {
  const dealId = req.query.dealId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const where = dealId ? eq(activities.dealId, dealId) : undefined;

  const data = await db.select().from(activities).where(where).orderBy(desc(activities.createdAt)).limit(limit);
  res.json({ data });
});

// Log an activity (userId auto-set from auth)
router.post('/', async (req, res) => {
  const [activity] = await db.insert(activities).values({
    ...req.body,
    userId: req.user!.userId,
  }).returning();
  res.status(201).json(activity);
});

export default router;
