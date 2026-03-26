import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, conversationMessages } from '@buildkit/shared';
import type { SmsJobData } from '@buildkit/shared';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

export async function processSmsSend(job: Job<SmsJobData>) {
  const { messageId, to, body } = job.data;

  console.log(`[sms-send] Processing SMS job ${job.id} — messageId: ${messageId}, to: ${to}`);

  try {
    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    await db.update(conversationMessages)
      .set({
        twilioSid: message.sid,
        status: message.status as 'queued' | 'sent' | 'delivered' | 'failed' | 'received',
      })
      .where(eq(conversationMessages.id, messageId));

    console.log(`[sms-send] SMS sent — Twilio SID: ${message.sid}, status: ${message.status}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[sms-send] Failed to send SMS for message ${messageId}:`, errorMessage);

    await db.update(conversationMessages)
      .set({ status: 'failed' })
      .where(eq(conversationMessages.id, messageId));

    throw err; // Let BullMQ retry
  }
}
