import { Router } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, timeEntries, projects, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Summary endpoint (must be before /:id to avoid route conflict)
router.get('/summary', async (req, res) => {
  const { projectId, userId } = req.query;

  const conditions = [];
  if (projectId) conditions.push(eq(timeEntries.projectId, projectId as string));
  if (userId) conditions.push(eq(timeEntries.userId, userId as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Aggregate totals
  const [totals] = await db.select({
    totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
    billableMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}) filter (where ${timeEntries.billable} = true), 0)::int`,
    nonBillableMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}) filter (where ${timeEntries.billable} = false), 0)::int`,
  })
    .from(timeEntries)
    .where(where);

  // Group by user
  const byUser = await db.select({
    userId: timeEntries.userId,
    userName: users.name,
    totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})::int`,
    billableMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}) filter (where ${timeEntries.billable} = true), 0)::int`,
  })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .where(where)
    .groupBy(timeEntries.userId, users.name);

  // Group by project (when no projectId filter)
  const byProject = await db.select({
    projectId: timeEntries.projectId,
    projectName: projects.name,
    totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})::int`,
    billableMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}) filter (where ${timeEntries.billable} = true), 0)::int`,
  })
    .from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(where)
    .groupBy(timeEntries.projectId, projects.name);

  res.json({
    ...totals,
    byUser,
    byProject,
  });
});

// List time entries with optional filters
router.get('/', async (req, res) => {
  const { projectId, userId, billable } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (projectId) conditions.push(eq(timeEntries.projectId, projectId as string));
  if (userId) conditions.push(eq(timeEntries.userId, userId as string));
  if (billable != null) conditions.push(eq(timeEntries.billable, billable === 'true'));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      id: timeEntries.id,
      projectId: timeEntries.projectId,
      taskId: timeEntries.taskId,
      userId: timeEntries.userId,
      description: timeEntries.description,
      durationMinutes: timeEntries.durationMinutes,
      date: timeEntries.date,
      billable: timeEntries.billable,
      createdAt: timeEntries.createdAt,
      projectName: projects.name,
      userName: users.name,
    })
      .from(timeEntries)
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(timeEntries.date)),
    db.select({ count: sql<number>`count(*)::int` }).from(timeEntries).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Create time entry
router.post('/', async (req, res) => {
  const [entry] = await db.insert(timeEntries).values({
    ...req.body,
    userId: req.user!.userId,
  }).returning();

  res.status(201).json(entry);
});

// Update time entry
router.patch('/:id', async (req, res) => {
  const [entry] = await db.update(timeEntries)
    .set(req.body)
    .where(eq(timeEntries.id, req.params.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: 'Time entry not found' });
    return;
  }
  res.json(entry);
});

// Delete time entry
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(timeEntries)
    .where(eq(timeEntries.id, req.params.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: 'Time entry not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
