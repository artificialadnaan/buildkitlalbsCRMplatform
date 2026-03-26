import type { Job } from 'bullmq';
import { eq, and, inArray } from 'drizzle-orm';
import { db, users, emailSends, sequenceEnrollments, activities } from '@buildkit/shared';
import { GmailProvider } from '@buildkit/email';
import type { GmailTokens } from '@buildkit/email';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;


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

export async function processGmailSync(job: Job<{ userId: string }>) {
  const { userId } = job.data;

  console.log(`[gmail-sync] Syncing Gmail for user ${userId}`);

  try {
    // Get user tokens and persisted historyId
    const [user] = await db.select({ googleTokens: users.googleTokens, email: users.email, gmailHistoryId: users.gmailHistoryId })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!user?.googleTokens) {
      console.log(`[gmail-sync] No tokens for user ${userId}, skipping`);
      return;
    }

    const tokens = await decryptTokens(user.googleTokens as string);
    const gmail = new GmailProvider(tokens, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

    // Refresh if needed
    const refreshed = await gmail.refreshIfNeeded();
    if (refreshed) {
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

    // Get or initialize history ID from DB
    let startHistoryId = user.gmailHistoryId ?? undefined;
    if (!startHistoryId) {
      const profile = await gmail.getProfile();
      startHistoryId = profile.historyId;
      await db.update(users).set({ gmailHistoryId: startHistoryId }).where(eq(users.id, userId));
      console.log(`[gmail-sync] Initialized historyId ${startHistoryId} for user ${userId}`);
      return; // First run — just set the baseline
    }

    // Fetch history since last sync
    const history = await gmail.getHistory(startHistoryId);
    await db.update(users).set({ gmailHistoryId: history.historyId }).where(eq(users.id, userId));

    if (history.messagesAdded.length === 0) {
      console.log(`[gmail-sync] No new messages for user ${userId}`);
      return;
    }

    console.log(`[gmail-sync] Found ${history.messagesAdded.length} new messages for user ${userId}`);

    // Check if any new messages are replies to tracked threads
    for (const msg of history.messagesAdded) {
      // Skip messages sent by the user (from our domain)
      if (msg.from.includes('@buildkitlabs.com')) continue;

      // Check if this threadId matches any tracked email sends
      const matchingSends = await db.select()
        .from(emailSends)
        .where(and(
          eq(emailSends.gmailThreadId, msg.threadId),
          eq(emailSends.sentBy, userId),
        ));

      if (matchingSends.length === 0) continue;

      console.log(`[gmail-sync] Reply detected on thread ${msg.threadId} from ${msg.from}`);

      // Get the deal from the first matching send
      const send = matchingSends[0];

      // Create activity for the reply
      await db.insert(activities).values({
        dealId: send.dealId,
        contactId: send.contactId,
        userId,
        type: 'email',
        subject: `Reply: ${msg.subject}`,
        body: msg.snippet,
        gmailThreadId: msg.threadId,
      });

      // Pause any active sequence enrollments for this deal
      if (send.dealId) {
        const activeEnrollments = await db.select()
          .from(sequenceEnrollments)
          .where(and(
            eq(sequenceEnrollments.dealId, send.dealId),
            eq(sequenceEnrollments.status, 'active'),
          ));

        for (const enrollment of activeEnrollments) {
          await db.update(sequenceEnrollments)
            .set({
              status: 'paused',
              pausedReason: 'reply_received',
              nextSendAt: null,
            })
            .where(eq(sequenceEnrollments.id, enrollment.id));

          console.log(`[gmail-sync] Auto-paused enrollment ${enrollment.id} — reply received`);
        }
      }
    }
  } catch (err) {
    console.error(`[gmail-sync] Error syncing for user ${userId}:`, err);
    throw err;
  }
}
