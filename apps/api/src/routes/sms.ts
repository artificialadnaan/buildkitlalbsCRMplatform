import { Router } from 'express';
import { eq, desc, asc, and } from 'drizzle-orm';
import {
  db,
  contacts,
  conversations,
  conversationMessages,
  companies,
  tasks,
} from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { sendSms } from '../lib/twilio.js';

const router = Router();

// ============================================================
// Authenticated routes
// ============================================================

router.use('/send', authMiddleware);
router.use('/conversations', authMiddleware);

// POST /send — Send SMS to a contact
router.post('/send', async (req, res) => {
  const { contactId, body, dealId } = req.body as {
    contactId: string;
    body: string;
    dealId?: string;
  };

  if (!contactId || !body) {
    res.status(400).json({ error: 'contactId and body are required' });
    return;
  }

  // Look up contact
  const [contact] = await db.select({
    id: contacts.id,
    phone: contacts.phone,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    companyId: contacts.companyId,
  })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }

  if (!contact.phone) {
    res.status(400).json({ error: 'Contact has no phone number' });
    return;
  }

  try {
    // Send via Twilio
    const { sid, status } = await sendSms(contact.phone, body);

    // Find or create conversation
    const existing = await db.select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.contactId, contactId),
          eq(conversations.channel, 'sms')
        )
      )
      .limit(1);

    let conversationId: string;

    if (existing.length > 0) {
      conversationId = existing[0].id;
      // Update lastMessageAt
      await db.update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } else {
      const [newConversation] = await db.insert(conversations).values({
        contactId,
        companyId: contact.companyId,
        dealId: dealId ?? null,
        channel: 'sms',
        lastMessageAt: new Date(),
      }).returning();
      conversationId = newConversation.id;
    }

    // Create outbound message record
    const [message] = await db.insert(conversationMessages).values({
      conversationId,
      direction: 'outbound',
      channel: 'sms',
      body,
      twilioSid: sid,
      status: status as 'queued' | 'sent' | 'delivered' | 'failed' | 'received',
    }).returning();

    res.status(201).json(message);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sms/send] Failed to send SMS:', errorMessage);
    res.status(500).json({ error: 'Failed to send SMS', details: errorMessage });
  }
});

// GET /conversations — List conversations (paginated)
router.get('/conversations', async (req, res) => {
  const { companyId, contactId, channel, page = '1', limit = '20' } = req.query as {
    companyId?: string;
    contactId?: string;
    channel?: string;
    page?: string;
    limit?: string;
  };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (companyId) conditions.push(eq(conversations.companyId, companyId));
  if (contactId) conditions.push(eq(conversations.contactId, contactId));
  if (channel) conditions.push(eq(conversations.channel, channel as 'email' | 'sms' | 'call' | 'internal'));

  const rows = await db.select({
    id: conversations.id,
    channel: conversations.channel,
    subject: conversations.subject,
    lastMessageAt: conversations.lastMessageAt,
    createdAt: conversations.createdAt,
    dealId: conversations.dealId,
    contactId: conversations.contactId,
    companyId: conversations.companyId,
    contactFirstName: contacts.firstName,
    contactLastName: contacts.lastName,
    contactPhone: contacts.phone,
    companyName: companies.name,
  })
    .from(conversations)
    .leftJoin(contacts, eq(conversations.contactId, contacts.id))
    .leftJoin(companies, eq(conversations.companyId, companies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ data: rows, page: pageNum, limit: limitNum });
});

// GET /conversations/:id/messages — Messages in a conversation (chronological)
router.get('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;

  const [conversation] = await db.select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = await db.select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, id))
    .orderBy(asc(conversationMessages.createdAt));

  res.json(messages);
});

// ============================================================
// Twilio inbound webhook — NO auth middleware
// ============================================================

// POST /webhook/inbound — Twilio inbound SMS webhook
router.post('/webhook/inbound', async (req, res) => {
  const { From: from, Body: body, MessageSid: messageSid } = req.body as {
    From: string;
    Body: string;
    MessageSid: string;
  };

  if (!from || !body) {
    res.type('text/xml').send('<Response/>');
    return;
  }

  try {
    // Match phone number to a contact
    const [contact] = await db.select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyId: contacts.companyId,
    })
      .from(contacts)
      .where(eq(contacts.phone, from))
      .limit(1);

    const contactId = contact?.id ?? null;
    const companyId = contact?.companyId ?? null;
    const contactName = contact
      ? `${contact.firstName} ${contact.lastName ?? ''}`.trim()
      : from;

    // Find or create conversation
    let conversationId: string;

    if (contactId) {
      const existing = await db.select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.contactId, contactId),
            eq(conversations.channel, 'sms')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        conversationId = existing[0].id;
        await db.update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));
      } else {
        const [newConv] = await db.insert(conversations).values({
          contactId,
          companyId,
          channel: 'sms',
          lastMessageAt: new Date(),
        }).returning();
        conversationId = newConv.id;
      }
    } else {
      // Unknown number — create an orphan conversation
      const [newConv] = await db.insert(conversations).values({
        channel: 'sms',
        lastMessageAt: new Date(),
      }).returning();
      conversationId = newConv.id;
    }

    // Store inbound message
    await db.insert(conversationMessages).values({
      conversationId,
      direction: 'inbound',
      channel: 'sms',
      body,
      senderPhone: from,
      senderName: contactName,
      twilioSid: messageSid,
      status: 'received',
    });

    // Auto-create task for the assigned rep if contact is known
    if (contactId) {
      await db.insert(tasks).values({
        title: `Follow up: SMS from ${contactName}`,
        source: 'system',
        status: 'todo',
        priority: 'medium',
      });
    }

    console.log(`[sms/webhook] Inbound SMS from ${from} — conversation ${conversationId}`);
  } catch (err) {
    console.error('[sms/webhook] Failed to process inbound SMS:', err instanceof Error ? err.message : err);
  }

  // Always return TwiML 200 so Twilio doesn't retry
  res.type('text/xml').send('<Response/>');
});

export default router;
