import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, files } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// List files for a project
router.get('/', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  const projectFiles = await db.select()
    .from(files)
    .where(eq(files.projectId, projectId));

  res.json(projectFiles);
});

// Approve a file
router.post('/:id/approve', async (req, res) => {
  const [file] = await db.update(files)
    .set({
      approvedAt: new Date(),
      approvedBy: req.user!.userId,
    })
    .where(eq(files.id, req.params.id))
    .returning();

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.json(file);
});

// Reject a file (remove approval requirement -- team can re-upload)
router.post('/:id/reject', async (req, res) => {
  const [file] = await db.update(files)
    .set({
      requiresApproval: false,
      approvedAt: null,
      approvedBy: null,
    })
    .where(eq(files.id, req.params.id))
    .returning();

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.json(file);
});

export default router;
