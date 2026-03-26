import { Router, type Request } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, tasks, milestones, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

type MilestoneParams = { milestoneId: string };

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// List tasks for a milestone
router.get('/', async (req: Request<MilestoneParams>, res) => {
  const { milestoneId } = req.params;

  const data = await db.select({
    id: tasks.id,
    milestoneId: tasks.milestoneId,
    assignedTo: tasks.assignedTo,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    dueDate: tasks.dueDate,
    createdAt: tasks.createdAt,
    assignedToName: users.name,
  })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(eq(tasks.milestoneId, milestoneId))
    .orderBy(tasks.createdAt);

  res.json(data);
});

// Create task
router.post('/', async (req: Request<MilestoneParams>, res) => {
  const { milestoneId } = req.params;

  const [task] = await db.insert(tasks).values({
    ...req.body,
    milestoneId,
  }).returning();

  res.status(201).json(task);
});

// Update task (with milestone auto-complete check)
router.patch('/:id', async (req, res) => {
  const [task] = await db.update(tasks)
    .set(req.body)
    .where(eq(tasks.id, req.params.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Auto-complete milestone: if all tasks in the milestone are done, mark milestone as done
  if (req.body.status === 'done' && task.milestoneId != null) {
    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    })
      .from(tasks)
      .where(eq(tasks.milestoneId, task.milestoneId));

    if (counts.total > 0 && counts.total === counts.done) {
      await db.update(milestones)
        .set({ status: 'done' })
        .where(eq(milestones.id, task.milestoneId));
    }
  }

  res.json(task);
});

// Delete task
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(tasks)
    .where(eq(tasks.id, req.params.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
