import { Router } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, projects, companies, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import type { ProjectStatus } from '@buildkit/shared';

const router = Router();

router.use(authMiddleware);

// List projects with optional filters
router.get('/', async (req, res) => {
  const { status, assignedTo } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(projects.status, status as ProjectStatus));
  if (assignedTo) conditions.push(eq(projects.assignedTo, assignedTo as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      id: projects.id,
      dealId: projects.dealId,
      companyId: projects.companyId,
      assignedTo: projects.assignedTo,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      targetLaunchDate: projects.targetLaunchDate,
      budget: projects.budget,
      createdAt: projects.createdAt,
      companyName: companies.name,
      assignedToName: users.name,
    })
      .from(projects)
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .leftJoin(users, eq(projects.assignedTo, users.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(projects.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(projects).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single project with related data
router.get('/:id', async (req, res) => {
  const [result] = await db.select({
    project: projects,
    companyName: companies.name,
    assignedToName: users.name,
  })
    .from(projects)
    .leftJoin(companies, eq(projects.companyId, companies.id))
    .leftJoin(users, eq(projects.assignedTo, users.id))
    .where(eq(projects.id, req.params.id))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(result);
});

// Create project
router.post('/', async (req, res) => {
  const [project] = await db.insert(projects).values({
    ...req.body,
    assignedTo: req.body.assignedTo || req.user!.userId,
  }).returning();

  res.status(201).json(project);
});

// Update project
router.patch('/:id', async (req, res) => {
  const [project] = await db.update(projects)
    .set(req.body)
    .where(eq(projects.id, req.params.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

export default router;
