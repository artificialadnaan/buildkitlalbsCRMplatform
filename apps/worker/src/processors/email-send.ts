import type { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db, emailSends, contacts, users, activities, conversations, conversationMessages } from '@buildkit/shared';
import type { EmailJobPayload } from '@buildkit/shared';
import { GmailProvider, injectTracking } from '@buildkit/email';
import type { GmailTokens } from '@buildkit/email';

// These are imported from a shared config module in the real app.
// Here we read from env for the worker process.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Dynamic import to avoid circular deps with the API lib
async function decryptTokens(encrypted: string): Promise<GmailTokens> {
  const crypto = await import('crypto');
  const ALGORITHM = 'aes-256-gcm';
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export async function processEmailSend(job: Job<EmailJobPayload>) {
  const { emailSendId, userId } = job.data;

  console.log(`[email-send] Processing email send ${emailSendId} for user ${userId}`);

  try {
    // Get the email send record
    const [send] = await db.select().from(emailSends).where(eq(emailSends.id, emailSendId)).limit(1);
    if (!send) {
      throw new Error(`Email send ${emailSendId} not found`);
    }

    if (send.status !== 'queued') {
      console.log(`[email-send] Skipping — status is ${send.status}`);
      return;
    }

    // Get user's Gmail tokens
    const [user] = await db.select({ googleTokens: users.googleTokens, email: users.email, name: users.name })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!user?.googleTokens) {
      throw new Error(`No Gmail tokens for user ${userId}`);
    }

    const tokens = await decryptTokens(user.googleTokens as string);
    const gmail = new GmailProvider(tokens, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

    // Refresh token if needed
    const refreshed = await gmail.refreshIfNeeded();
    if (refreshed) {
      // Re-encrypt and store updated tokens
      const crypto = await import('crypto');
      const ALGORITHM = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
      let encrypted = cipher.update(JSON.stringify(refreshed), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      const encryptedStr = `${iv.toString('hex')}:${authTag}:${encrypted}`;
      await db.update(users).set({ googleTokens: encryptedStr }).where(eq(users.id, userId));
    }

    // Get recipient email
    let recipientEmail = '';
    if (send.contactId) {
      const [contact] = await db.select({ email: contacts.email })
        .from(contacts).where(eq(contacts.id, send.contactId)).limit(1);
      recipientEmail = contact?.email || '';
    }

    if (!recipientEmail) {
      throw new Error('No recipient email found');
    }

    // Inject open/click tracking into HTML body
    const apiBaseUrl = process.env.API_BASE_URL || 'https://buildkitapi-production.up.railway.app';
    const trackedHtml = injectTracking(send.bodyHtml || '', emailSendId, apiBaseUrl);

    // Send via Gmail
    const result = await gmail.send({
      to: recipientEmail,
      from: user.email,
      subject: send.subject || '(no subject)',
      html: trackedHtml,
    });

    // Update email send record
    await db.update(emailSends)
      .set({
        status: 'sent',
        gmailMessageId: result.messageId,
        gmailThreadId: result.threadId,
        sentAt: new Date(),
      })
      .where(eq(emailSends.id, emailSendId));

    // Create activity record
    await db.insert(activities).values({
      dealId: send.dealId,
      contactId: send.contactId,
      userId,
      type: 'email',
      subject: send.subject,
      body: send.bodyHtml,
      gmailThreadId: result.threadId,
    });

    // Thread email into conversations
    if (send.contactId) {
      const existingConv = await db.select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.contactId, send.contactId),
          eq(conversations.channel, 'email'),
        ))
        .limit(1);

      let conversationId: string;

      if (existingConv.length > 0) {
        conversationId = existingConv[0].id;
        await db.update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));
      } else {
        const [newConv] = await db.insert(conversations).values({
          contactId: send.contactId,
          companyId: null,
          dealId: send.dealId ?? null,
          channel: 'email',
          subject: send.subject ?? null,
          lastMessageAt: new Date(),
        }).returning();
        conversationId = newConv.id;
      }

      await db.insert(conversationMessages).values({
        conversationId,
        direction: 'outbound',
        channel: 'email',
        body: send.bodyHtml || send.subject || '(no body)',
        senderEmail: user.email,
        senderName: user.name ?? null,
        status: 'sent',
      });
    }

    console.log(`[email-send] Sent email ${emailSendId} — Gmail message ${result.messageId}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[email-send] Failed to send email ${emailSendId}:`, errorMessage);

    await db.update(emailSends)
      .set({ status: 'failed', errorMessage })
      .where(eq(emailSends.id, emailSendId));

    throw err; // Let BullMQ retry
  }
}
