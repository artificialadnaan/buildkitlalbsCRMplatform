import { Router } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { db, scrapeJobs, createScrapeQueue } from '@buildkit/shared';
import type { ScrapeJobData } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

let scrapeQueue: ReturnType<typeof createScrapeQueue> | null = null;

function getQueue() {
  if (!scrapeQueue) {
    scrapeQueue = createScrapeQueue();
  }
  return scrapeQueue;
}

// Enqueue a new scrape job
router.post('/', async (req, res) => {
  const { zipCodes, searchQuery } = req.body;

  // Validate input
  if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
    res.status(400).json({ error: 'zipCodes must be a non-empty array of zip code strings' });
    return;
  }

  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0) {
    res.status(400).json({ error: 'searchQuery is required' });
    return;
  }

  // Validate zip codes are strings of 5 digits
  const validZips = zipCodes.every((z: unknown) =>
    typeof z === 'string' && /^\d{5}$/.test(z)
  );
  if (!validZips) {
    res.status(400).json({ error: 'Each zip code must be a 5-digit string' });
    return;
  }

  // Create scrape_jobs row
  const [job] = await db.insert(scrapeJobs).values({
    startedBy: req.user!.userId,
    zipCodes,
    searchQuery: searchQuery.trim(),
  }).returning();

  // Enqueue BullMQ job
  const jobData: ScrapeJobData = {
    jobId: job.id,
    zipCodes,
    searchQuery: searchQuery.trim(),
    startedBy: req.user!.userId,
  };

  try {
    await getQueue().add(`scrape-${job.id}`, jobData, {
      jobId: job.id,
    });
  } catch (err) {
    // If Redis/BullMQ is unavailable, still return the DB job — worker will pick it up later
    console.error('[Scrape API] Failed to enqueue job to BullMQ:', err);
  }

  res.status(201).json(job);
});

// List all scrape jobs (most recent first)
router.get('/jobs', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db.select().from(scrapeJobs).orderBy(desc(scrapeJobs.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(scrapeJobs),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Get single scrape job by ID
router.get('/jobs/:id', async (req, res) => {
  const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, req.params.id)).limit(1);

  if (!job) {
    res.status(404).json({ error: 'Scrape job not found' });
    return;
  }

  res.json(job);
});

export default router;
