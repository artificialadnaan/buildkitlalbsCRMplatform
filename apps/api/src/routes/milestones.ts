import { Router, type Request } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db, milestones } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// List milestones for a project (sorted by position)
router.get('/', async (req: Request<{ projectId: string }>, res) => {
  const { projectId } = req.params;

  const data = await db.select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.position));

  res.json(data);
});

// Create milestone
router.post('/', async (req: Request<{ projectId: string }>, res) => {
  const { projectId } = req.params;

  const [milestone] = await db.insert(milestones).values({
    ...req.body,
    projectId,
  }).returning();

  res.status(201).json(milestone);
});

// Update milestone
router.patch('/:id', async (req, res) => {
  const [milestone] = await db.update(milestones)
    .set(req.body)
    .where(eq(milestones.id, req.params.id))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: 'Milestone not found' });
    return;
  }
  res.json(milestone);
});

// Delete milestone
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(milestones)
    .where(eq(milestones.id, req.params.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: 'Milestone not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
