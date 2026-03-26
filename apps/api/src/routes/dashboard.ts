import { Router } from 'express';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { db, deals, activities, users, projects, tasks, milestones as milestonesTable, emailSends } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Aggregate deal + project stats
router.get('/stats', async (req, res) => {
  const [dealStats] = await db.select({
    activeDeals: sql<number>`count(*) filter (where ${deals.status} = 'open')::int`,
    pipelineValue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'open'), 0)::int`,
    wonDeals: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
    wonValue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won'), 0)::int`,
  }).from(deals);

  const [projectStats] = await db.select({
    activeProjects: sql<number>`count(*) filter (where ${projects.status} = 'active')::int`,
    totalProjects: sql<number>`count(*)::int`,
  }).from(projects);

  const [taskStats] = await db.select({
    openTasks: sql<number>`count(*) filter (where ${tasks.status} != 'done')::int`,
    dueSoonTasks: sql<number>`count(*) filter (where ${tasks.status} != 'done' and ${tasks.dueDate} <= current_date + interval '7 days')::int`,
  }).from(tasks);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [emailStats] = await db.select({
    emailsSentThisMonth: sql<number>`count(*)::int`,
  })
    .from(emailSends)
    .where(and(
      eq(emailSends.status, 'sent'),
      gte(emailSends.sentAt, monthStart),
    ));

  res.json({
    ...dealStats,
    ...projectStats,
    ...taskStats,
    ...emailStats,
  });
});

// My upcoming tasks
router.get('/my-tasks', async (req, res) => {
  const userId = req.user!.userId;
  const limit = parseInt(req.query.limit as string) || 10;

  const data = await db.select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
    priority: tasks.priority,
    dueDate: tasks.dueDate,
    milestoneName: milestonesTable.name,
    projectName: projects.name,
  })
    .from(tasks)
    .innerJoin(milestonesTable, eq(tasks.milestoneId, milestonesTable.id))
    .innerJoin(projects, eq(milestonesTable.projectId, projects.id))
    .where(and(
      eq(tasks.assignedTo, userId),
      sql`${tasks.status} != 'done'`
    ))
    .orderBy(tasks.dueDate)
    .limit(limit);

  res.json(data);
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
