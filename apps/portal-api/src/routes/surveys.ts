import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, satisfactionSurveys } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';

const router = Router();
router.use(portalAuthMiddleware);

// GET /portal/surveys — list surveys for authenticated portal user
router.get('/', async (req, res) => {
  const portalUserId = req.portalUser!.portalUserId;

  const rows = await db
    .select()
    .from(satisfactionSurveys)
    .where(eq(satisfactionSurveys.portalUserId, portalUserId))
    .orderBy(satisfactionSurveys.sentAt);

  res.json(rows);
});

// POST /portal/surveys/:id — submit survey response
router.post('/:id', async (req, res) => {
  const portalUserId = req.portalUser!.portalUserId;
  const { rating, comment } = req.body as { rating: number; comment?: string };

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    return;
  }

  const [existing] = await db
    .select()
    .from(satisfactionSurveys)
    .where(
      and(
        eq(satisfactionSurveys.id, req.params.id),
        eq(satisfactionSurveys.portalUserId, portalUserId),
      )
    )
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }

  const [updated] = await db
    .update(satisfactionSurveys)
    .set({
      rating,
      comment: comment ?? null,
      respondedAt: new Date(),
    })
    .where(eq(satisfactionSurveys.id, req.params.id))
    .returning();

  res.json(updated);
});

export default router;
