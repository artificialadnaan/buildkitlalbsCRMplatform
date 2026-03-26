import { Queue } from 'bullmq';

// Email queues
export const EMAIL_SEND_QUEUE = 'email:send';
export const SEQUENCE_TICK_QUEUE = 'email:sequence-tick';
export const GMAIL_SYNC_QUEUE = 'email:gmail-sync';

export const EMAIL_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
};

// Scrape queues
export const SCRAPE_QUEUE_NAME = 'scrape-leads';

export interface ScrapeJobData {
  jobId: string;
  zipCodes: string[];
  searchQuery: string;
  startedBy: string;
}

export interface ScrapeJobProgress {
  zipCode: string;
  processed: number;
  total: number;
  newLeads: number;
  duplicatesSkipped: number;
}

export function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

export function createScrapeQueue() {
  return new Queue<ScrapeJobData>(SCRAPE_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}
