import { Router } from 'express';
import { eq, asc, sql, and, isNull } from 'drizzle-orm';
import { db, messages, users, contacts } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Get messages for a project (team view)
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;

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
      senderName = user?.name || 'Team';
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

// Send a message (from team)
router.post('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { body } = req.body;

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ error: 'Message body is required' });
    return;
  }

  const [message] = await db.insert(messages).values({
    projectId,
    senderType: 'team',
    senderId: req.user!.userId,
    body: body.trim(),
  }).returning();

  // Get sender name
  const [user] = await db.select({ name: users.name })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);

  res.status(201).json({
    ...message,
    senderName: user?.name || 'Team',
  });
});

// Get unread count (messages from clients not yet read by team)
router.get('/:projectId/unread', async (req, res) => {
  const { projectId } = req.params;

  const [result] = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, projectId),
        eq(messages.senderType, 'client'),
        isNull(messages.readAt)
      )
    );

  res.json({ unread: result.count });
});

export default router;
