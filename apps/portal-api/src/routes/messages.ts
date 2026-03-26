import { Router } from 'express';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import { db, messages, users, contacts, projects } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';
import { emitToCompany } from '../lib/socket.js';

const router = Router();

router.use(portalAuthMiddleware);

// Get messages for a project
router.get('/:projectId', async (req, res) => {
  const companyId = req.portalUser!.companyId;
  const { projectId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  // Verify project belongs to this portal user's company
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.companyId !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Fetch messages with sender name via LEFT JOINs — no N+1
  const rows = await db.execute<{
    id: string;
    project_id: string;
    sender_type: string;
    sender_id: string;
    body: string;
    created_at: Date;
    read_at: Date | null;
    user_name: string | null;
    contact_first: string | null;
    contact_last: string | null;
  }>(sql`
    SELECT m.*,
      u.name AS user_name,
      ct.first_name AS contact_first,
      ct.last_name AS contact_last
    FROM messages m
    LEFT JOIN users u ON m.sender_type = 'team' AND u.id = m.sender_id
    LEFT JOIN contacts ct ON m.sender_type = 'client' AND ct.id = m.sender_id
    WHERE m.project_id = ${projectId}
    ORDER BY m.created_at ASC
    LIMIT ${limit}
  `);

  const enriched = rows.rows.map(r => ({
    ...r,
    senderName: r.sender_type === 'team'
      ? (r.user_name || 'Team Member')
      : (r.contact_first ? `${r.contact_first} ${r.contact_last || ''}`.trim() : 'Client'),
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

  // Verify project belongs to this portal user's company
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.companyId !== companyId) {
    res.status(403).json({ error: 'Access denied' });
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
