import 'dotenv/config';
import { Worker } from 'bullmq';
import cron from 'node-cron';
import { SCRAPE_QUEUE_NAME, getRedisConnection } from '@buildkit/shared';
import type { ScrapeJobData } from '@buildkit/shared';
import { processScrapeJob } from './processors/scrape.js';
import { processInvoicePdf } from './jobs/invoicePdf.js';
import { processInvoiceReminders } from './jobs/invoiceReminder.js';

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

worker.on('completed', (job) => {
  console.log(`[Worker] Scrape job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Scrape job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log(`[Worker] BuildKit CRM Worker started — listening on queue "${SCRAPE_QUEUE_NAME}"`);

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
