import { Router } from 'express';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, deals, companies, contacts, pipelineStages, projects, milestones, portalUsers, milestoneTemplates, milestoneTemplateItems, pipelines, dealEvents, emailSends, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import { generateCallPrep } from '../lib/call-prep.js';
import { rescoreCompany } from '../lib/lead-scoring.js';
import { logDealEvent } from '../lib/deal-event.js';

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

// Bulk create one deal per company
router.post('/bulk', async (req, res) => {
  const { companyIds, pipelineId } = req.body as { companyIds: string[]; pipelineId: string };
  if (!companyIds?.length || !pipelineId) { res.status(400).json({ error: 'companyIds and pipelineId required' }); return; }
  const [firstStage] = await db.select().from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(pipelineStages.position).limit(1);
  if (!firstStage) { res.status(400).json({ error: 'Pipeline has no stages' }); return; }

  const created = [];
  for (const companyId of companyIds) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) continue;
    const [deal] = await db.insert(deals).values({
      companyId, pipelineId, stageId: firstStage.id,
      title: `${company.name} — New Deal`,
      assignedTo: req.user!.userId,
    }).returning();
    created.push(deal);
  }
  res.status(201).json({ created: created.length, deals: created });
});

// Download deal summary as PDF
router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!deal) { res.status(404).json({ error: 'Deal not found' }); return; }

  const [company] = deal.companyId
    ? await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1)
    : [null];
  const [contact] = deal.contactId
    ? await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1)
    : [null];
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, deal.stageId)).limit(1);
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, deal.pipelineId)).limit(1);

  // Fetch recent deal events
  let events: any[] = [];
  try {
    events = await db.select({
      type: dealEvents.type,
      fromValue: dealEvents.fromValue,
      toValue: dealEvents.toValue,
      createdAt: dealEvents.createdAt,
      userName: users.name,
    }).from(dealEvents)
      .leftJoin(users, eq(dealEvents.userId, users.id))
      .where(eq(dealEvents.dealId, id))
      .orderBy(desc(dealEvents.createdAt))
      .limit(20);
  } catch { /* table may not exist yet */ }

  // Email stats
  const [emailStats] = await db.select({
    sent: sql<number>`count(*)::int`,
  }).from(emailSends).where(eq(emailSends.dealId, id));

  // Generate PDF
  const doc = new PDFDocument({ margin: 50, size: 'letter' });
  const filename = `deal-summary-${deal.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.fontSize(22).font('Helvetica-Bold').text('BuildKit Labs', { align: 'center' });
  doc.fontSize(11).font('Helvetica').fillColor('#666').text('Deal Summary Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#e0e0e0').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(1);

  // Deal title + value
  doc.fillColor('#000').fontSize(18).font('Helvetica-Bold').text(deal.title);
  doc.fontSize(12).font('Helvetica').fillColor('#444');
  doc.text(`$${(deal.value ?? 0).toLocaleString()} USD`, { continued: false });
  doc.moveDown(0.8);

  // Info grid
  const info: [string, string][] = [
    ['Pipeline', pipeline?.name ?? '--'],
    ['Stage', stage?.name ?? '--'],
    ['Status', deal.status.toUpperCase()],
    ['Company', company?.name ?? '--'],
    ['Contact', contact ? `${contact.firstName} ${contact.lastName ?? ''}`.trim() : '--'],
    ['Email', contact?.email ?? '--'],
    ['Created', new Date(deal.createdAt).toLocaleDateString()],
    ['Expected Close', deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Not set'],
  ];

  doc.fontSize(10).font('Helvetica');
  for (const [label, value] of info) {
    doc.fillColor('#888').text(`${label}: `, { continued: true }).fillColor('#222').text(value);
  }
  doc.moveDown(1);

  // Email tracking
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Email Tracking');
  doc.fontSize(10).font('Helvetica').fillColor('#444');
  doc.text(`Emails Sent: ${emailStats?.sent ?? 0}`);
  doc.moveDown(1);

  // Activity timeline
  if (events.length > 0) {
    doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Recent Activity');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    for (const event of events) {
      const date = new Date(event.createdAt).toLocaleDateString();
      const typeLabel = event.type.replace(/_/g, ' ');
      const detail = event.toValue || event.fromValue || '';
      doc.fillColor('#888').text(`${date}  `, { continued: true })
        .fillColor('#444').text(`${typeLabel}`, { continued: true })
        .fillColor('#222').text(detail ? ` — ${detail}` : '');
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#aaa').text(
    `Generated by BuildKit Labs CRM — ${new Date().toLocaleString()}`,
    { align: 'center' }
  );

  doc.end();
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
  if (deal.companyId) rescoreCompany(deal.companyId).catch(err => console.error('[rescore] Error:', err));
  res.status(201).json(deal);
});

// Update deal
router.patch('/:id', async (req, res) => {
  const [dealBefore] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
  const updates = { ...req.body };

  // Auto-set closedAt when status changes to won/lost
  if (updates.status === 'won' || updates.status === 'lost') {
    updates.closedAt = new Date();

    // Auto-move to the matching pipeline stage ("Won" or "Lost")
    const pipelineId = updates.pipelineId ?? dealBefore?.pipelineId;
    if (pipelineId) {
      const stageName = updates.status === 'won' ? 'Won' : 'Lost';
      const [matchedStage] = await db
        .select()
        .from(pipelineStages)
        .where(and(eq(pipelineStages.pipelineId, pipelineId), eq(pipelineStages.name, stageName)))
        .limit(1);
      if (matchedStage) {
        updates.stageId = matchedStage.id;
      }
    }
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

  // Log stage change event
  if (updates.stageId && updates.stageId !== dealBefore?.stageId) {
    const [fromStage] = await db.select({ name: pipelineStages.name }).from(pipelineStages).where(eq(pipelineStages.id, dealBefore.stageId)).limit(1);
    const [toStage] = await db.select({ name: pipelineStages.name }).from(pipelineStages).where(eq(pipelineStages.id, updates.stageId)).limit(1);
    logDealEvent({ dealId: deal.id, type: 'stage_change', fromValue: fromStage?.name, toValue: toStage?.name, userId: req.user!.userId }).catch(console.error);
  }

  // Log status change event
  if (updates.status && updates.status !== dealBefore?.status) {
    logDealEvent({ dealId: deal.id, type: 'status_change', fromValue: dealBefore.status, toValue: updates.status, userId: req.user!.userId }).catch(console.error);
  }

  res.json(deal);
});

// Get deal event timeline
router.get('/:id/events', async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  const [events, countResult] = await Promise.all([
    db.select({
      id: dealEvents.id,
      type: dealEvents.type,
      fromValue: dealEvents.fromValue,
      toValue: dealEvents.toValue,
      userId: dealEvents.userId,
      metadata: dealEvents.metadata,
      createdAt: dealEvents.createdAt,
      userName: users.name,
    })
      .from(dealEvents)
      .leftJoin(users, eq(dealEvents.userId, users.id))
      .where(eq(dealEvents.dealId, id))
      .orderBy(desc(dealEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(dealEvents).where(eq(dealEvents.dealId, id)),
  ]);

  res.json({ data: events, total: countResult[0].count, page, limit });
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

// Get call prep (auto-generate if none exists)
router.get('/:id/call-prep', async (req, res) => {
  try {
    const [deal] = await db.select({ callPrep: deals.callPrep }).from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const callPrep = deal.callPrep ?? await generateCallPrep(req.params.id);
    res.json(callPrep);
  } catch (err) {
    console.error('[call-prep] GET error:', err);
    res.status(500).json({ error: 'Failed to generate call prep' });
  }
});

// Force regenerate call prep
router.post('/:id/call-prep', async (req, res) => {
  try {
    const callPrep = await generateCallPrep(req.params.id);
    res.json(callPrep);
  } catch (err) {
    console.error('[call-prep] POST error:', err);
    res.status(500).json({ error: 'Failed to generate call prep' });
  }
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
