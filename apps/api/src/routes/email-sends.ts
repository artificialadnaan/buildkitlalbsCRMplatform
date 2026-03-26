import { Router } from 'express';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { db, emailSends, emailTemplates, contacts, companies, emailEvents, deals } from '@buildkit/shared';
import { resolveVariables } from '@buildkit/email';
import { authMiddleware } from '../middleware/auth.js';
import { Queue } from 'bullmq';
import { EMAIL_SEND_QUEUE, getRedisConnection } from '@buildkit/shared';
import type { EmailJobPayload } from '@buildkit/shared';

const DAILY_SEND_LIMIT = 2000;

let _emailSendQueue: Queue<EmailJobPayload> | null = null;
function getEmailSendQueue() {
  if (!_emailSendQueue) {
    _emailSendQueue = new Queue<EmailJobPayload>(EMAIL_SEND_QUEUE, { connection: getRedisConnection() });
  }
  return _emailSendQueue;
}

const router = Router();

router.use(authMiddleware);

// List email sends — supports ?dealId= for deal-scoped view, or returns all for history view
router.get('/', async (req, res) => {
  const dealId = req.query.dealId as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const where = dealId ? eq(emailSends.dealId, dealId) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: emailSends.id,
        subject: emailSends.subject,
        status: emailSends.status,
        sentAt: emailSends.sentAt,
        createdAt: emailSends.createdAt,
        errorMessage: emailSends.errorMessage,
        dealId: emailSends.dealId,
        dealTitle: deals.title,
        contactId: emailSends.contactId,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactEmail: contacts.email,
        sentBy: emailSends.sentBy,
      })
      .from(emailSends)
      .leftJoin(contacts, eq(emailSends.contactId, contacts.id))
      .leftJoin(deals, eq(emailSends.dealId, deals.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(emailSends.createdAt)),
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

// Get tracking events for an email send
router.get('/:id/events', async (req, res) => {
  const { id } = req.params;

  const [send] = await db.select({ id: emailSends.id })
    .from(emailSends)
    .where(eq(emailSends.id, id))
    .limit(1);

  if (!send) {
    res.status(404).json({ error: 'Email send not found' });
    return;
  }

  const events = await db.select()
    .from(emailEvents)
    .where(eq(emailEvents.emailSendId, id))
    .orderBy(emailEvents.createdAt);

  const opens = events.filter(e => e.type === 'open');
  const clicks = events.filter(e => e.type === 'click');

  res.json({
    events,
    summary: {
      openCount: opens.length,
      clickCount: clicks.length,
      firstOpenedAt: opens[0]?.createdAt ?? null,
      lastOpenedAt: opens.length > 0 ? opens[opens.length - 1].createdAt : null,
    },
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
  await getEmailSendQueue().add('send', {
    emailSendId: emailSend.id,
    userId: req.user!.userId,
  });

  res.status(201).json(emailSend);
});

export default router;
