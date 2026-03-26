import type { Job } from 'bullmq';
import type { ScrapeJobData } from '@buildkit/shared';

export async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  console.log(`[Scrape] Placeholder — job ${job.data.jobId} will be implemented in Task 4`);
}
