import { Queue, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, users } from '@buildkit/shared';
import { EMAIL_SEND_QUEUE, SEQUENCE_TICK_QUEUE, GMAIL_SYNC_QUEUE, EMAIL_QUEUE_OPTIONS } from '@buildkit/shared';
import { processEmailSend } from './processors/email-send.js';
import { processSequenceTick } from './processors/sequence-tick.js';
import { processGmailSync } from './processors/gmail-sync.js';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export function setupEmailQueues() {
  // Email send queue — processes individual email sends
  const emailSendWorker = new Worker(EMAIL_SEND_QUEUE, processEmailSend, {
    connection: redisConnection,
    concurrency: 5,
    ...EMAIL_QUEUE_OPTIONS,
  });

  emailSendWorker.on('completed', (job) => {
    console.log(`[email-send] Job ${job.id} completed`);
  });

  emailSendWorker.on('failed', (job, err) => {
    console.error(`[email-send] Job ${job?.id} failed:`, err.message);
  });

  // Sequence tick queue — repeatable job that checks for due sequence steps
  const sequenceTickQueue = new Queue(SEQUENCE_TICK_QUEUE, { connection: redisConnection });
  const sequenceTickWorker = new Worker(SEQUENCE_TICK_QUEUE, processSequenceTick, {
    connection: redisConnection,
    concurrency: 1,
  });

  // Run sequence tick every 60 seconds
  sequenceTickQueue.add('tick', {}, {
    repeat: { every: 60_000 },
    removeOnComplete: { count: 10 },
  });

  sequenceTickWorker.on('failed', (job, err) => {
    console.error(`[sequence-tick] Job failed:`, err.message);
  });

  // Gmail sync queue — repeatable job per user
  const gmailSyncQueue = new Queue(GMAIL_SYNC_QUEUE, { connection: redisConnection });
  const gmailSyncWorker = new Worker(GMAIL_SYNC_QUEUE, processGmailSync, {
    connection: redisConnection,
    concurrency: 3,
  });

  // Schedule Gmail sync for all users with tokens every 2 minutes
  scheduleGmailSyncJobs(gmailSyncQueue);

  gmailSyncWorker.on('failed', (job, err) => {
    console.error(`[gmail-sync] Job failed:`, err.message);
  });

  console.log('[worker] Email queues initialized:');
  console.log('  - email:send (concurrency: 5)');
  console.log('  - email:sequence-tick (every 60s)');
  console.log('  - email:gmail-sync (every 2min per user)');

  return { emailSendWorker, sequenceTickWorker, gmailSyncWorker };
}

async function scheduleGmailSyncJobs(queue: Queue) {
  // Get all users with Gmail tokens
  const teamUsers = await db.select({ id: users.id })
    .from(users);

  for (const user of teamUsers) {
    await queue.add(`sync-${user.id}`, { userId: user.id }, {
      repeat: { every: 120_000 }, // 2 minutes
      removeOnComplete: { count: 5 },
      jobId: `gmail-sync-${user.id}`,
    });
  }

  console.log(`[gmail-sync] Scheduled sync for ${teamUsers.length} users`);
}
