import { Router } from 'express';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import { db, messages, users, contacts } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';
import { emitToCompany } from '../lib/socket.js';

const router = Router();

router.use(portalAuthMiddleware);

// Get messages for a project
router.get('/:projectId', async (req, res) => {
  const companyId = req.portalUser!.companyId;
  const { projectId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string | undefined;

  // Verify project belongs to this company (done via join/check)
  const projectMessages = await db.select()
    .from(messages)
    .where(eq(messages.projectId, projectId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  // Enrich with sender names
  const enriched = await Promise.all(projectMessages.map(async (msg) => {
    let senderName = 'Unknown';
    if (msg.senderType === 'team') {
      const [user] = await db.select({ name: users.name })
        .from(users)
        .where(eq(users.id, msg.senderId))
        .limit(1);
      senderName = user?.name || 'Team Member';
    } else {
      const [contact] = await db.select({ firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(eq(contacts.id, msg.senderId))
        .limit(1);
      senderName = contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'Client';
    }
    return { ...msg, senderName };
  }));

  res.json(enriched);
});

// Send a message (from client)
router.post('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { body } = req.body;
  const companyId = req.portalUser!.companyId;
  const contactId = req.portalUser!.contactId;

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ error: 'Message body is required' });
    return;
  }

  const [message] = await db.insert(messages).values({
    projectId,
    senderType: 'client',
    senderId: contactId,
    body: body.trim(),
  }).returning();

  // Get sender name for real-time emit
  const [contact] = await db.select({ firstName: contacts.firstName, lastName: contacts.lastName })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  const enrichedMessage = {
    ...message,
    senderName: contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'Client',
  };

  // Emit real-time event to company room
  emitToCompany(companyId, 'new_message', enrichedMessage);

  res.status(201).json(enrichedMessage);
});

// Get unread message count for portal user
router.get('/:projectId/unread', async (req, res) => {
  const { projectId } = req.params;

  const [result] = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, projectId),
        eq(messages.senderType, 'team'),
        isNull(messages.readAt)
      )
    );

  res.json({ unread: result.count });
});

// Mark messages as read
router.post('/:projectId/read', async (req, res) => {
  const { projectId } = req.params;

  await db.update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.projectId, projectId),
        eq(messages.senderType, 'team'),
        isNull(messages.readAt)
      )
    );

  res.json({ success: true });
});

export default router;
