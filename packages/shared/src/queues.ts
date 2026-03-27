import { Queue } from 'bullmq';
import type { WebsiteAuditJobData, OutreachPipelineJobData, NotificationJobData, ReportJobData } from './types/index.js';

// SMS queues
export const SMS_SEND_QUEUE = 'sms-send';

export interface SmsJobData {
  messageId: string;
  to: string;
  body: string;
}

// Email queues
export const EMAIL_SEND_QUEUE = 'email-send';
export const SEQUENCE_TICK_QUEUE = 'email-sequence-tick';
export const GMAIL_SYNC_QUEUE = 'email-gmail-sync';

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

// New feature queues
export const WEBSITE_AUDIT_QUEUE = 'website-audit';
export const OUTREACH_PIPELINE_QUEUE = 'outreach-pipeline';
export const NOTIFICATION_QUEUE = 'notification';
export const REPORT_QUEUE = 'report-generation';

export interface ScrapeJobData {
  jobId: string;
  zipCodes: string[];
  searchQuery: string;
  startedBy: string;
  maxLeads?: number;
  mode?: 'standard' | 'ai-prospect';
  prospectConfig?: { minReviews?: number; maxWebsiteScore?: number };
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

export function createWebsiteAuditQueue() {
  return new Queue<WebsiteAuditJobData>(WEBSITE_AUDIT_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 10000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
}

export function createOutreachPipelineQueue() {
  return new Queue<OutreachPipelineJobData>(OUTREACH_PIPELINE_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

export function createNotificationQueue() {
  return new Queue<NotificationJobData>(NOTIFICATION_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createReportQueue() {
  return new Queue<ReportJobData>(REPORT_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 10000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

// Prospect queue
export const PROSPECT_QUEUE_NAME = 'prospect-pipeline';

export interface ProspectJobData {
  companyId: string;
  scrapeJobId: string;
  stage: 'qualify' | 'enrich' | 'mockup' | 'outreach';
}

export function createProspectQueue() {
  return new Queue<ProspectJobData>(PROSPECT_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential' as const, delay: 5000 } },
  });
}

// Dedicated mockup queue — separate from prospect pipeline to allow concurrency: 1
export const PROSPECT_MOCKUP_QUEUE_NAME = 'prospect-mockup';

export function createProspectMockupQueue() {
  return new Queue<ProspectJobData>(PROSPECT_MOCKUP_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 30000 }, // 30s backoff for rate limits
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

// Enrichment queue
export const ENRICHMENT_QUEUE = 'lead-enrichment';

export interface EnrichmentJobData {
  companyId: string;
  website: string;
  companyName: string;
}

export function createEnrichmentQueue() {
  return new Queue<EnrichmentJobData>(ENRICHMENT_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 15000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
}
