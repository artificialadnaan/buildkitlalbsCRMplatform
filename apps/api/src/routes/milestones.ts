import { Router, type Request } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db, milestones, messages, satisfactionSurveys, notifications, projects, portalUsers } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// List milestones for a project (sorted by position)
router.get('/', async (req: Request<{ projectId: string }>, res) => {
  const { projectId } = req.params;

  const data = await db.select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.position));

  res.json(data);
});

// Create milestone
router.post('/', async (req: Request<{ projectId: string }>, res) => {
  const { projectId } = req.params;

  const [milestone] = await db.insert(milestones).values({
    ...req.body,
    projectId,
  }).returning();

  res.status(201).json(milestone);
});

// Update milestone
router.patch('/:id', async (req, res) => {
  const [before] = await db.select().from(milestones).where(eq(milestones.id, req.params.id)).limit(1);

  const [milestone] = await db.update(milestones)
    .set(req.body)
    .where(eq(milestones.id, req.params.id))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: 'Milestone not found' });
    return;
  }

  // Completion triggers: fire when status transitions to 'done'
  if (req.body.status === 'done' && before?.status !== 'done') {
    const projectId = milestone.projectId;

    // 1. Auto-create a message in the messages table
    db.insert(messages).values({
      projectId,
      senderType: 'team',
      senderId: req.user!.userId,
      body: `Milestone '${milestone.name}' has been completed!`,
    }).catch(err => console.error('Failed to create milestone completion message:', err));

    // 2. Auto-create a satisfaction_survey for each portal user linked to the project's company
    db.select({ companyId: projects.companyId, assignedTo: projects.assignedTo })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then(async ([project]) => {
        if (!project) return;

        // Create surveys for portal users of the company
        const companyPortalUsers = await db
          .select()
          .from(portalUsers)
          .where(eq(portalUsers.companyId, project.companyId));

        if (companyPortalUsers.length > 0) {
          await db.insert(satisfactionSurveys).values(
            companyPortalUsers.map(pu => ({
              projectId,
              milestoneId: milestone.id,
              portalUserId: pu.id,
            }))
          );
        }

        // 3. Create a notification for the project's assigned user
        if (project.assignedTo) {
          await db.insert(notifications).values({
            userId: project.assignedTo,
            type: 'milestone_completed' as const,
            title: 'Milestone Completed',
            body: `Milestone '${milestone.name}' has been marked as done.`,
            entityType: 'milestone',
            entityId: milestone.id,
          });
        }
      })
      .catch(err => console.error('Failed to run milestone completion triggers:', err));
  }

  res.json(milestone);
});

// Delete milestone
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(milestones)
    .where(eq(milestones.id, req.params.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: 'Milestone not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
