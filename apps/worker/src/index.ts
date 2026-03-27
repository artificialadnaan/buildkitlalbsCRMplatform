import 'dotenv/config';
import { Worker } from 'bullmq';
import cron from 'node-cron';
import {
  SCRAPE_QUEUE_NAME,
  WEBSITE_AUDIT_QUEUE,
  OUTREACH_PIPELINE_QUEUE,
  SMS_SEND_QUEUE,
  ENRICHMENT_QUEUE,
  getRedisConnection,
  createOutreachPipelineQueue,
  db,
  outreachCampaigns,
} from '@buildkit/shared';
import { eq } from 'drizzle-orm';
import type { ScrapeJobData, WebsiteAuditJobData, OutreachPipelineJobData, SmsJobData, EnrichmentJobData } from '@buildkit/shared';
import { processScrapeJob } from './processors/scrape.js';
import { processWebsiteAudit } from './processors/website-audit.js';
import { processEnrichment } from './processors/enrichment.js';
import { processOutreachPipeline } from './processors/outreach-pipeline.js';
import { processInvoicePdf } from './jobs/invoicePdf.js';
import { processInvoiceReminders } from './jobs/invoiceReminder.js';
import { setupEmailQueues } from './setup-email-queues.js';
import { processSmsSend } from './processors/sms-send.js';
import { checkStaleDeals } from './jobs/staleDealChecker.js';
import { sendDailyDigest } from './jobs/dailyDigest.js';
import { checkFollowUpReminders } from './jobs/follow-up-reminders.js';

console.log('[worker] Starting BuildKit CRM worker...');

const connection = getRedisConnection();

const worker = new Worker<ScrapeJobData>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    console.log(`[Worker] Processing scrape job ${job.id} — query: "${job.data.searchQuery}", zips: ${job.data.zipCodes.join(', ')}`);
    await processScrapeJob(job);
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

let outreachPipelineQueue: ReturnType<typeof createOutreachPipelineQueue> | null = null;
function getOutreachPipelineQueue() {
  if (!outreachPipelineQueue) outreachPipelineQueue = createOutreachPipelineQueue();
  return outreachPipelineQueue;
}

worker.on('completed', async (job) => {
  console.log(`[Worker] Scrape job ${job.id} completed`);

  // If this scrape job is linked to an outreach campaign, advance the pipeline
  try {
    const scrapeJobId = job.data.jobId as string | undefined;
    if (!scrapeJobId) return;

    const [campaign] = await db
      .select({ id: outreachCampaigns.id, status: outreachCampaigns.status })
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.scrapeJobId, scrapeJobId))
      .limit(1);

    if (campaign && campaign.status !== 'cancelled') {
      console.log(`[Worker] Scrape job ${scrapeJobId} linked to campaign ${campaign.id} — enqueueing audit phase`);
      await getOutreachPipelineQueue().add(`pipeline-audit-${campaign.id}`, {
        campaignId: campaign.id,
        phase: 'audit',
      } satisfies OutreachPipelineJobData);
    }
  } catch (err) {
    console.error('[Worker] Failed to advance outreach pipeline after scrape:', err);
  }
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Scrape job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log(`[Worker] BuildKit CRM Worker started — listening on queue "${SCRAPE_QUEUE_NAME}"`);

// Website audit worker
const auditWorker = new Worker<WebsiteAuditJobData>(
  WEBSITE_AUDIT_QUEUE,
  async (job) => {
    console.log(`[Worker] Processing website-audit job ${job.id} — company: ${job.data.companyId}`);
    await processWebsiteAudit(job);
  },
  {
    connection,
    concurrency: 3,
  },
);

auditWorker.on('completed', (job) => {
  console.log(`[Worker] Website-audit job ${job.id} completed`);
});

auditWorker.on('failed', (job, err) => {
  console.error(`[Worker] Website-audit job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] Website audit worker started — listening on queue "${WEBSITE_AUDIT_QUEUE}"`);

// Outreach pipeline worker
const outreachWorker = new Worker<OutreachPipelineJobData>(
  OUTREACH_PIPELINE_QUEUE,
  async (job) => {
    console.log(`[Worker] Processing outreach-pipeline job ${job.id} — campaign: ${job.data.campaignId}, phase: ${job.data.phase}`);
    await processOutreachPipeline(job);
  },
  {
    connection,
    concurrency: 1,
  },
);

outreachWorker.on('completed', (job) => {
  console.log(`[Worker] Outreach-pipeline job ${job.id} completed (phase: ${job.data.phase})`);
});

outreachWorker.on('failed', (job, err) => {
  console.error(`[Worker] Outreach-pipeline job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] Outreach pipeline worker started — listening on queue "${OUTREACH_PIPELINE_QUEUE}"`);

// Invoice PDF generation worker
const invoiceWorker = new Worker(
  'invoice',
  async (job) => {
    console.log(`[Worker] Processing invoice job ${job.id} — type: ${job.name}`);
    if (job.name === 'generate-invoice-pdf') {
      await processInvoicePdf(job.data);
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

invoiceWorker.on('completed', (job) => {
  console.log(`[Worker] Invoice job ${job.id} completed`);
});

invoiceWorker.on('failed', (job, err) => {
  console.error(`[Worker] Invoice job ${job?.id} failed:`, err.message);
});

// Run overdue invoice check daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily overdue invoice check...');
  try {
    await processInvoiceReminders();
  } catch (err) {
    console.error('Invoice reminder job failed:', err);
  }
});

console.log('[Worker] Invoice worker and daily reminder cron registered');

// Stale deal check — daily at 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[Worker] Running stale deal check...');
  try {
    await checkStaleDeals();
  } catch (err) {
    console.error('[Worker] Stale deal checker failed:', err);
  }
});

// Daily digest — daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('[Worker] Running daily digest...');
  try {
    await sendDailyDigest();
  } catch (err) {
    console.error('[Worker] Daily digest failed:', err);
  }
});

console.log('[Worker] Stale deal checker and daily digest crons registered');

// Follow-up reminders — daily at 9:00 AM CT (14:00 UTC)
cron.schedule('0 14 * * *', () => {
  checkFollowUpReminders().catch(err => console.error('[follow-up] Cron error:', err));
});

console.log('[Worker] Follow-up reminder cron registered');

// Start email workers (send, sequence-tick, gmail-sync)
setupEmailQueues();
console.log('[Worker] Email workers started (send, sequence-tick, gmail-sync)');

// SMS send worker
const smsSendWorker = new Worker<SmsJobData>(
  SMS_SEND_QUEUE,
  async (job) => {
    console.log(`[Worker] Processing sms-send job ${job.id} — messageId: ${job.data.messageId}`);
    await processSmsSend(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

smsSendWorker.on('completed', (job) => {
  console.log(`[Worker] SMS send job ${job.id} completed`);
});

smsSendWorker.on('failed', (job, err) => {
  console.error(`[Worker] SMS send job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] SMS send worker started — listening on queue "${SMS_SEND_QUEUE}"`);

// Lead enrichment worker
const enrichmentWorker = new Worker<EnrichmentJobData>(
  ENRICHMENT_QUEUE,
  async (job) => {
    console.log(`[Worker] Processing enrichment job ${job.id} — company: ${job.data.companyId}`);
    await processEnrichment(job);
  },
  {
    connection,
    concurrency: 2,
  },
);

enrichmentWorker.on('completed', (job) => {
  console.log(`[Worker] Enrichment job ${job.id} completed`);
});

enrichmentWorker.on('failed', (job, err) => {
  console.error(`[Worker] Enrichment job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] Enrichment worker started — listening on queue "${ENRICHMENT_QUEUE}"`);
