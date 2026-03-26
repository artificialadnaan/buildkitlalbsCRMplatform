import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, emailTemplates } from '@buildkit/shared';
import { resolveVariables } from '@buildkit/email';
import { authMiddleware } from '../middleware/auth.js';
import type { PipelineType } from '@buildkit/shared';

const router = Router();

router.use(authMiddleware);

// List email templates with optional pipeline type filter
router.get('/', async (req, res) => {
  const pipelineType = req.query.pipelineType as PipelineType | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const where = pipelineType ? eq(emailTemplates.pipelineType, pipelineType) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(emailTemplates).where(where).limit(limit).offset(offset).orderBy(emailTemplates.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(emailTemplates).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single template
router.get('/:id', async (req, res) => {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id)).limit(1);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

// Create template
router.post('/', async (req, res, next) => {
  // Guard against /preview hitting this handler
  if (req.path === '/preview') return next();

  const [template] = await db.insert(emailTemplates).values({
    ...req.body,
    createdBy: req.user!.userId,
  }).returning();

  res.status(201).json(template);
});

// Preview template with resolved variables
router.post('/preview', async (req, res) => {
  const { subject, bodyHtml, variables } = req.body;

  const resolvedSubject = resolveVariables(subject || '', variables || {});
  const resolvedBody = resolveVariables(bodyHtml || '', variables || {});

  res.json({ subject: resolvedSubject, bodyHtml: resolvedBody });
});

// Update template
router.patch('/:id', async (req, res) => {
  const [template] = await db.update(emailTemplates)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(emailTemplates.id, req.params.id))
    .returning();

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

// Delete template
router.delete('/:id', async (req, res) => {
  const [deleted] = await db.delete(emailTemplates).where(eq(emailTemplates.id, req.params.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
