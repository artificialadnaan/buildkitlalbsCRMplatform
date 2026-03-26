import { Router } from 'express';
import { eq, desc, asc, and } from 'drizzle-orm';
import {
  db,
  contacts,
  conversations,
  conversationMessages,
  companies,
  deals,
} from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { sendSms, twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio.js';
import { createFollowUpTask } from '../lib/auto-task.js';

const router = Router();

// ============================================================
// Authenticated routes
// ============================================================

router.use('/send', authMiddleware);
router.use('/conversations', authMiddleware);
router.use('/call', authMiddleware);

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

  // Map to frontend-expected shape
  const data = rows.map(r => ({
    id: r.id,
    contactId: r.contactId,
    contactName: [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || r.companyName || 'Unknown',
    contactPhone: r.contactPhone,
    contactEmail: null,
    companyName: r.companyName,
    channel: r.channel,
    subject: r.subject,
    lastMessagePreview: r.subject || '',
    lastMessageAt: r.lastMessageAt,
    unread: false,
    dealId: r.dealId,
  }));

  res.json({ data, page: pageNum, limit: limitNum });
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

  res.json({ data: messages });
});

// ============================================================
// Twilio inbound webhook — NO auth middleware
// POST /call — Initiate outbound call (authenticated)
router.post('/call', async (req, res) => {
  const { contactId, dealId } = req.body;
  if (!contactId) { res.status(400).json({ error: 'contactId required' }); return; }

  const [contact] = await db.select({
    id: contacts.id,
    phone: contacts.phone,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    companyId: contacts.companyId,
  }).from(contacts).where(eq(contacts.id, contactId)).limit(1);

  if (!contact?.phone) { res.status(400).json({ error: 'Contact has no phone number' }); return; }

  try {
    const { makeCall } = await import('../lib/twilio.js');
    const { sid, status } = await makeCall(contact.phone);
    const contactName = `${contact.firstName} ${contact.lastName ?? ''}`.trim();

    // Create conversation
    let [conv] = await db.select().from(conversations).where(and(eq(conversations.contactId, contactId), eq(conversations.channel, 'call'))).limit(1);
    if (!conv) {
      [conv] = await db.insert(conversations).values({
        companyId: contact.companyId,
        contactId,
        dealId: dealId ?? null,
        channel: 'call',
        subject: `Calls with ${contactName}`,
        lastMessageAt: new Date(),
      }).returning();
    } else {
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conv.id));
    }

    await db.insert(conversationMessages).values({
      conversationId: conv.id,
      direction: 'outbound',
      channel: 'call',
      body: `Outbound call to ${contactName}`,
      senderName: 'BuildKit Labs',
      twilioSid: sid,
      status: status as any,
    });

    res.json({ sid, status, message: `Calling ${contactName} at ${contact.phone}` });
  } catch (err) {
    console.error('[sms/call] Failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

// ============================================================
// Twilio webhooks — NO auth middleware
// ============================================================

// POST /webhook/status — SMS delivery status callback (no auth)
router.post('/webhook/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;
    if (MessageSid && MessageStatus) {
      const statusMap: Record<string, string> = {
        queued: 'queued', sent: 'sent', delivered: 'delivered',
        undelivered: 'failed', failed: 'failed',
      };
      const newStatus = statusMap[MessageStatus] ?? MessageStatus;
      await db.update(conversationMessages)
        .set({ status: newStatus as any })
        .where(eq(conversationMessages.twilioSid, MessageSid));
    }
  } catch (err) {
    console.error('[sms/status] Error:', err instanceof Error ? err.message : err);
  }
  res.sendStatus(200);
});

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
    let conversationExisted = false;

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
        conversationExisted = true;
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

    // Auto-create follow-up task if contact is known
    if (contactId) {
      // Look up the contact's most recent open deal
      const [deal] = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.contactId, contactId), eq(deals.status, 'open')))
        .limit(1);

      const dealId = deal?.id;

      // High priority if replying to an existing conversation thread
      const isReply = conversationExisted;

      const bodyPreview = body.length > 50 ? body.slice(0, 50) + '…' : body;

      await createFollowUpTask({
        dealId,
        title: `Follow up: SMS from ${contactName} — ${bodyPreview}`,
        source: 'system',
        priority: isReply ? 'high' : 'medium',
      });
    }

    console.log(`[sms/webhook] Inbound SMS from ${from} — conversation ${conversationId}`);
  } catch (err) {
    console.error('[sms/webhook] Failed to process inbound SMS:', err instanceof Error ? err.message : err);
  }

  // Always return TwiML 200 so Twilio doesn't retry
  res.type('text/xml').send('<Response/>');
});

// ──── Voice Webhooks ────

// POST /webhook/voice — Inbound call (no auth)
router.post('/webhook/voice', async (req, res) => {
  try {
    const from = req.body.From || req.body.Caller || '';
    const callSid = req.body.CallSid || '';
    const normalizedFrom = from.replace(/\D/g, '').slice(-10);

    // Match caller to contact
    const allContacts = await db.select({
      id: contacts.id,
      phone: contacts.phone,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyId: contacts.companyId,
    }).from(contacts);

    const matchedContact = allContacts.find(c => c.phone?.replace(/\D/g, '').slice(-10) === normalizedFrom);
    const contactName = matchedContact ? `${matchedContact.firstName} ${matchedContact.lastName ?? ''}`.trim() : from;

    // Find or create conversation
    const [conversation] = matchedContact
      ? await db.select().from(conversations).where(and(eq(conversations.contactId, matchedContact.id), eq(conversations.channel, 'call'))).limit(1)
      : [];

    let conversationId: string;
    if (conversation) {
      conversationId = conversation.id;
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
    } else {
      const [newConv] = await db.insert(conversations).values({
        companyId: matchedContact?.companyId ?? null,
        contactId: matchedContact?.id ?? null,
        channel: 'call',
        subject: `Call from ${contactName}`,
        lastMessageAt: new Date(),
      }).returning();
      conversationId = newConv.id;
    }

    // Log the call
    await db.insert(conversationMessages).values({
      conversationId,
      direction: 'inbound',
      channel: 'call',
      body: `Inbound call from ${contactName}`,
      senderName: contactName,
      senderPhone: from,
      twilioSid: callSid,
      status: 'received',
    });

    // Auto-create follow-up task
    const { createFollowUpTask } = await import('../lib/auto-task.js');
    let dealId: string | undefined;
    if (matchedContact) {
      const [deal] = await db.select({ id: deals.id }).from(deals).where(eq(deals.companyId, matchedContact.companyId)).limit(1);
      dealId = deal?.id;
    }
    await createFollowUpTask({
      dealId,
      title: `Follow up: Missed call from ${contactName}`,
      source: 'system',
      priority: 'high',
    });

    console.log(`[voice/webhook] Inbound call from ${from} — logged`);
  } catch (err) {
    console.error('[voice/webhook] Error:', err instanceof Error ? err.message : err);
  }

  // TwiML response — ring the team then voicemail
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="25" callerId="+14698888214" action="/webhook/voice/status">
    <Number>+14696902240</Number>
  </Dial>
  <Say voice="alice">Sorry we missed your call. Please leave a message and we'll get back to you as soon as possible.</Say>
</Response>`);
});

// POST /webhook/voice/status — Call status updates (no auth)
router.post('/webhook/voice/status', async (req, res) => {
  try {
    const callSid = req.body.CallSid;
    const duration = req.body.CallDuration;
    const status = req.body.CallStatus;

    if (callSid && duration) {
      const [msg] = await db.select().from(conversationMessages).where(eq(conversationMessages.twilioSid, callSid)).limit(1);
      if (msg) {
        await db.update(conversationMessages).set({
          metadata: { duration: parseInt(duration), status },
        }).where(eq(conversationMessages.id, msg.id));
      }
    }
  } catch (err) {
    console.error('[voice/status] Error:', err instanceof Error ? err.message : err);
  }
  res.sendStatus(200);
});

export default router;
