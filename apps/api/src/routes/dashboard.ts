import { Router } from 'express';
import { eq, sql, desc } from 'drizzle-orm';
import { db, deals, activities, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Aggregate deal stats
router.get('/stats', async (req, res) => {
  const [dealStats] = await db.select({
    activeDeals: sql<number>`count(*) filter (where ${deals.status} = 'open')::int`,
    pipelineValue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'open'), 0)::int`,
    wonDeals: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
    wonValue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won'), 0)::int`,
  }).from(deals);

  res.json(dealStats);
});

// Recent activity feed with user names
router.get('/activity', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;

  const data = await db.select({
    activity: activities,
    userName: users.name,
  })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .orderBy(desc(activities.createdAt))
    .limit(limit);

  res.json(data);
});

export default router;
