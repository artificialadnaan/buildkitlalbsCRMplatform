import { Router } from 'express';
import { eq, inArray, and } from 'drizzle-orm';
import { db, changeRequests, milestones, tasks, projects } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import type { ChangeRequestStatus } from '@buildkit/shared';

const router = Router();
router.use(authMiddleware);

// GET /api/change-requests/project/:projectId — list change requests for a project
router.get('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;

  const rows = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.projectId, projectId))
    .orderBy(changeRequests.createdAt);

  res.json(rows);
});

// PATCH /api/change-requests/:id — update status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: ChangeRequestStatus };

  const validStatuses: ChangeRequestStatus[] = ['submitted', 'reviewed', 'approved', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status value' });
    return;
  }

  const [existing] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Change request not found' });
    return;
  }

  let taskId = existing.taskId;

  // If approving, auto-create a task in the project's first active milestone
  if (status === 'approved' && !existing.taskId) {
    const [firstMilestone] = await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, existing.projectId),
          eq(milestones.status, 'in_progress'),
        )
      )
      .orderBy(milestones.position)
      .limit(1);

    // Fall back to first pending milestone if no in_progress one
    const targetMilestone = firstMilestone ?? await db
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, existing.projectId),
          eq(milestones.status, 'pending'),
        )
      )
      .orderBy(milestones.position)
      .limit(1)
      .then(rows => rows[0]);

    if (targetMilestone) {
      const [newTask] = await db
        .insert(tasks)
        .values({
          milestoneId: targetMilestone.id,
          title: `Change Request: ${existing.title}`,
          description: existing.description,
          priority: existing.priority,
          status: 'todo',
        })
        .returning();

      taskId = newTask.id;
    }
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status,
      taskId,
      reviewedAt: new Date(),
    })
    .where(eq(changeRequests.id, id))
    .returning();

  res.json(updated);
});

export default router;
