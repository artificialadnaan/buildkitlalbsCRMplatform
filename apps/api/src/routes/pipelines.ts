import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db, pipelines, pipelineStages } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authMiddleware);

// List all pipelines with their stages
router.get('/', async (req, res) => {
  const allPipelines = await db.select().from(pipelines);
  const allStages = await db.select().from(pipelineStages).orderBy(asc(pipelineStages.position));

  const result = allPipelines.map(p => ({
    ...p,
    stages: allStages.filter(s => s.pipelineId === p.id),
  }));

  res.json(result);
});

// Add stage to pipeline (admin only)
router.post('/:id/stages', requireRole('admin'), async (req, res) => {
  const [stage] = await db.insert(pipelineStages).values({
    ...req.body,
    pipelineId: req.params.id as string,
  }).returning();
  res.status(201).json(stage);
});

// Update a stage (admin only)
router.patch('/stages/:id', requireRole('admin'), async (req, res) => {
  const [stage] = await db.update(pipelineStages).set(req.body).where(eq(pipelineStages.id, req.params.id as string)).returning();
  if (!stage) {
    res.status(404).json({ error: 'Stage not found' });
    return;
  }
  res.json(stage);
});

// Delete a stage (admin only)
router.delete('/stages/:id', requireRole('admin'), async (req, res) => {
  const [deleted] = await db.delete(pipelineStages).where(eq(pipelineStages.id, req.params.id as string)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Stage not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
