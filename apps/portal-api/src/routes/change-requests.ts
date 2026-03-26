import { Router } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { db, changeRequests, projects } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';

const router = Router();
router.use(portalAuthMiddleware);

// POST /portal/change-requests — submit a change request
router.post('/', async (req, res) => {
  const portalUserId = req.portalUser!.portalUserId;
  const companyId = req.portalUser!.companyId;
  const { projectId, title, description, priority } = req.body as {
    projectId: string;
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
  };

  if (!projectId || !title || !description) {
    res.status(400).json({ error: 'projectId, title, and description are required' });
    return;
  }

  // Verify the project belongs to this portal user's company
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.companyId !== companyId) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const [newRequest] = await db
    .insert(changeRequests)
    .values({
      projectId,
      portalUserId,
      title,
      description,
      priority: priority ?? 'medium',
      status: 'submitted',
    })
    .returning();

  res.status(201).json(newRequest);
});

// GET /portal/change-requests — list change requests for portal user's projects
router.get('/', async (req, res) => {
  const companyId = req.portalUser!.companyId;

  // Get all projects for this company
  const companyProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.companyId, companyId));

  if (companyProjects.length === 0) {
    res.json([]);
    return;
  }

  const projectIds = companyProjects.map(p => p.id);

  const rows = await db
    .select()
    .from(changeRequests)
    .where(inArray(changeRequests.projectId, projectIds))
    .orderBy(changeRequests.createdAt);

  res.json(rows);
});

export default router;
