import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db, deals, companies, contacts, pipelineStages, projects, milestones, portalUsers, milestoneTemplates, milestoneTemplateItems, pipelines } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
router.use(authMiddleware);

// List deals with filters and joined metadata
router.get('/', async (req, res) => {
  const { pipelineId, status, assignedTo } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (pipelineId) conditions.push(eq(deals.pipelineId, pipelineId as string));
  if (status) conditions.push(eq(deals.status, status as 'open' | 'won' | 'lost'));
  if (assignedTo) conditions.push(eq(deals.assignedTo, assignedTo as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      deal: deals,
      companyName: companies.name,
      contactName: contacts.firstName,
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
      stagePosition: pipelineStages.position,
    })
      .from(deals)
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(deals.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(deals).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single deal with joined metadata
router.get('/:id', async (req, res) => {
  const [result] = await db.select({
    deal: deals,
    companyName: companies.name,
    contactName: contacts.firstName,
    contactEmail: contacts.email,
    stageName: pipelineStages.name,
  })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(eq(deals.id, req.params.id as string))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  res.json(result);
});

// Create deal
router.post('/', async (req, res) => {
  const [deal] = await db.insert(deals).values({
    ...req.body,
    assignedTo: req.body.assignedTo || req.user!.userId,
  }).returning();
  logAudit({ userId: req.user!.userId, action: 'create', entity: 'deal', entityId: deal.id, changes: { after: deal } });
  res.status(201).json(deal);
});

// Update deal
router.patch('/:id', async (req, res) => {
  const [dealBefore] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
  const updates = { ...req.body };

  // Auto-set closedAt when status changes to won/lost
  if (updates.status === 'won' || updates.status === 'lost') {
    updates.closedAt = new Date();
  }

  const [deal] = await db.update(deals)
    .set(updates)
    .where(eq(deals.id, req.params.id))
    .returning();

  if (!deal) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }

  // Deal -> Project conversion when status changes to "won"
  if (updates.status === 'won') {
    // Check if a project already exists for this deal (prevent duplicates)
    const existing = await db.select().from(projects).where(eq(projects.dealId, deal.id)).limit(1);

    if (existing.length === 0) {
      // Determine project type based on pipeline name
      const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, deal.pipelineId)).limit(1);
      const projectType = pipeline?.name === 'Construction' ? 'software' as const : 'website' as const;

      // Create the project
      const [project] = await db.insert(projects).values({
        dealId: deal.id,
        companyId: deal.companyId,
        assignedTo: deal.assignedTo || req.user!.userId,
        name: deal.title,
        type: projectType,
        status: 'active',
        budget: deal.value,
      }).returning();

      // Copy milestone template items as milestones
      const [template] = await db.select()
        .from(milestoneTemplates)
        .where(eq(milestoneTemplates.projectType, projectType))
        .limit(1);

      if (template) {
        const templateItems = await db.select()
          .from(milestoneTemplateItems)
          .where(eq(milestoneTemplateItems.templateId, template.id))
          .orderBy(milestoneTemplateItems.position);

        if (templateItems.length > 0) {
          await db.insert(milestones).values(
            templateItems.map(item => ({
              projectId: project.id,
              name: item.name,
              position: item.position,
              status: 'pending' as const,
            }))
          );
        }
      }

      // Create portal_user for the primary contact
      if (deal.contactId) {
        const [contact] = await db.select()
          .from(contacts)
          .where(and(eq(contacts.id, deal.contactId), eq(contacts.isPrimary, true)))
          .limit(1);

        // If the linked contact is not primary, still try to find a primary contact for the company
        const primaryContact = contact || (
          await db.select()
            .from(contacts)
            .where(and(eq(contacts.companyId, deal.companyId), eq(contacts.isPrimary, true)))
            .limit(1)
        )[0];

        if (primaryContact?.email) {
          // Check if portal user already exists for this contact
          const existingPortalUser = await db.select()
            .from(portalUsers)
            .where(eq(portalUsers.contactId, primaryContact.id))
            .limit(1);

          if (existingPortalUser.length === 0) {
            const [newPortalUser] = await db.insert(portalUsers).values({
              contactId: primaryContact.id,
              companyId: deal.companyId,
              email: primaryContact.email,
            }).returning();

            // Generate magic link token for portal access
            const magicToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

            await db.update(portalUsers)
              .set({ magicLinkToken: magicToken, tokenExpiresAt: tokenExpiry })
              .where(eq(portalUsers.id, newPortalUser.id));

            // Log the portal URL (in production this would be emailed)
            console.log(`[Portal] Magic link for ${primaryContact.email}: ${process.env.PORTAL_URL || 'https://buildkitportal-production.up.railway.app'}/auth/verify/${magicToken}`);
          }
        }
      }
    }
  }

  logAudit({ userId: req.user!.userId, action: 'update', entity: 'deal', entityId: deal.id, changes: { before: dealBefore, after: deal } });
  res.json(deal);
});

// Move deal to a different stage (drag-and-drop support)
router.patch('/:id/stage', async (req, res) => {
  const { stageId } = req.body;
  const [stageBefore] = await db.select().from(deals).where(eq(deals.id, req.params.id as string)).limit(1);
  const [deal] = await db.update(deals).set({ stageId }).where(eq(deals.id, req.params.id as string)).returning();
  if (!deal) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  logAudit({ userId: req.user!.userId, action: 'update', entity: 'deal', entityId: deal.id, changes: { before: { stageId: stageBefore?.stageId }, after: { stageId } } });
  res.json(deal);
});

// Delete deal
router.delete('/:id', async (req, res) => {
  const dealDeleteId = req.params.id as string;
  const [deleted] = await db.delete(deals).where(eq(deals.id, dealDeleteId)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }
  logAudit({ userId: req.user!.userId, action: 'delete', entity: 'deal', entityId: dealDeleteId, changes: { before: deleted } });
  res.json({ success: true });
});

export default router;
