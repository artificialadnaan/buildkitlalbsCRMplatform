import 'dotenv/config';
import { Worker } from 'bullmq';
import { SCRAPE_QUEUE_NAME, getRedisConnection } from '@buildkit/shared';
import type { ScrapeJobData } from '@buildkit/shared';
import { processScrapeJob } from './processors/scrape.js';

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
