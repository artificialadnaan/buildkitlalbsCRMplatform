import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db, projects, milestones } from '@buildkit/shared';
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

export default router;
