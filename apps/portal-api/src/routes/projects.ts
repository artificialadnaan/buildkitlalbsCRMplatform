import { Router } from 'express';
import { eq, asc, sql } from 'drizzle-orm';
import { db, projects, milestones, tasks } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';

const router = Router();

router.use(portalAuthMiddleware);

// List projects for the authenticated client's company
router.get('/', async (req, res) => {
  const companyId = req.portalUser!.companyId;

  const companyProjects = await db.select()
    .from(projects)
    .where(eq(projects.companyId, companyId));

  // Fetch milestones for progress calculation
  const projectIds = companyProjects.map(p => p.id);
  const allMilestones = projectIds.length > 0
    ? await db.select().from(milestones).orderBy(asc(milestones.position))
    : [];

  const result = companyProjects.map(project => {
    const projectMilestones = allMilestones.filter(m => m.projectId === project.id);
    const doneCount = projectMilestones.filter(m => m.status === 'done').length;
    const progressPercent = projectMilestones.length > 0
      ? Math.round((doneCount / projectMilestones.length) * 100)
      : 0;

    return {
      ...project,
      milestones: projectMilestones,
      progressPercent,
    };
  });

  res.json(result);
});

// Get single project with milestones
router.get('/:id', async (req, res) => {
  const companyId = req.portalUser!.companyId;

  const [project] = await db.select()
    .from(projects)
    .where(eq(projects.id, req.params.id))
    .limit(1);

  if (!project || project.companyId !== companyId) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const projectMilestones = await db.select()
    .from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(asc(milestones.position));

  const doneCount = projectMilestones.filter(m => m.status === 'done').length;
  const progressPercent = projectMilestones.length > 0
    ? Math.round((doneCount / projectMilestones.length) * 100)
    : 0;

  res.json({
    ...project,
    milestones: projectMilestones,
    progressPercent,
  });
});

// Get milestone + task progress for a project
router.get('/:id/progress', async (req, res) => {
  const companyId = req.portalUser!.companyId;
  const { id } = req.params;

  // Verify project belongs to this company
  const [project] = await db.select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project || project.companyId !== companyId) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const projectMilestones = await db.select({
    id: milestones.id,
    name: milestones.name,
    status: milestones.status,
    position: milestones.position,
  }).from(milestones).where(eq(milestones.projectId, id)).orderBy(asc(milestones.position));

  const milestonesWithTasks = await Promise.all(projectMilestones.map(async (m) => {
    const [taskStats] = await db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    }).from(tasks).where(eq(tasks.milestoneId, m.id));

    const total = taskStats?.total ?? 0;
    const completed = taskStats?.completed ?? 0;

    return {
      ...m,
      taskTotal: total,
      taskCompleted: completed,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }));

  const completedCount = milestonesWithTasks.filter(m => m.status === 'done').length;

  res.json({
    milestones: milestonesWithTasks,
    overallProgress: projectMilestones.length > 0
      ? Math.round((completedCount / projectMilestones.length) * 100)
      : 0,
    completedCount,
    totalCount: projectMilestones.length,
  });
});

export default router;
