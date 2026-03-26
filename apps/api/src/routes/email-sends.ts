import { Router } from 'express';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db, emailSends, emailTemplates, contacts, companies } from '@buildkit/shared';
import { resolveVariables } from '@buildkit/email';
import { authMiddleware } from '../middleware/auth.js';
import { Queue } from 'bullmq';
import { EMAIL_SEND_QUEUE } from '@buildkit/shared';
import type { EmailJobPayload } from '@buildkit/shared';

const DAILY_SEND_LIMIT = 2000;

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const emailSendQueue = new Queue<EmailJobPayload>(EMAIL_SEND_QUEUE, { connection: redisConnection });

const router = Router();

router.use(authMiddleware);

// List email sends for a deal
router.get('/', async (req, res) => {
  const dealId = req.query.dealId as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const where = dealId ? eq(emailSends.dealId, dealId) : eq(emailSends.sentBy, req.user!.userId);

  const [data, countResult] = await Promise.all([
    db.select().from(emailSends).where(where).limit(limit).offset(offset).orderBy(emailSends.createdAt),
    db.select({ count: sql<number>`count(*)::int` }).from(emailSends).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get daily send count for current user
router.get('/daily-count', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailSends)
    .where(and(
      eq(emailSends.sentBy, req.user!.userId),
      gte(emailSends.createdAt, today),
    ));

  const count = result.count;
  res.json({
    count,
    limit: DAILY_SEND_LIMIT,
    remaining: Math.max(0, DAILY_SEND_LIMIT - count),
    warningThreshold: count >= DAILY_SEND_LIMIT * 0.8,
  });
});

// Queue an email send
router.post('/', async (req, res) => {
  const { dealId, contactId, templateId, subject, bodyHtml } = req.body;

  let resolvedSubject = subject;
  let resolvedBody = bodyHtml;

  // If using a template, resolve variables
  if (templateId) {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, templateId)).limit(1);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Fetch contact and company data for variable resolution
    const [contact] = await db.select({
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      companyName: companies.name,
      companyWebsite: companies.website,
      companyCity: companies.city,
      companyIndustry: companies.industry,
    })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(eq(contacts.id, contactId))
      .limit(1);

    const variables: Record<string, string> = {
      'contact.first_name': contact?.firstName || '',
      'contact.last_name': contact?.lastName || '',
      'contact.email': contact?.email || '',
      'company.name': contact?.companyName || '',
      'company.website': contact?.companyWebsite || '',
      'company.city': contact?.companyCity || '',
      'company.industry': contact?.companyIndustry || '',
      'user.name': req.user!.email.split('@')[0],
      'user.email': req.user!.email,
    };

    resolvedSubject = resolveVariables(template.subject, variables);
    resolvedBody = resolveVariables(template.bodyHtml, variables);
  }

  const [emailSend] = await db.insert(emailSends).values({
    dealId,
    contactId,
    templateId: templateId || null,
    sentBy: req.user!.userId,
    subject: resolvedSubject,
    bodyHtml: resolvedBody,
    status: 'queued',
  }).returning();

  // Enqueue BullMQ job for the worker to send via Gmail
  await emailSendQueue.add('send', {
    emailSendId: emailSend.id,
    userId: req.user!.userId,
  });

  res.status(201).json(emailSend);
});

export default router;
