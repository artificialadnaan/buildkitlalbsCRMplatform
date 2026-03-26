import { Router } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import {
  db,
  scrapeJobs,
  outreachCampaigns,
  createScrapeQueue,
  createOutreachPipelineQueue,
} from '@buildkit/shared';
import type { ScrapeJobData, OutreachPipelineJobData } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

let scrapeQueue: ReturnType<typeof createScrapeQueue> | null = null;
let outreachQueue: ReturnType<typeof createOutreachPipelineQueue> | null = null;

function getScrapeQueue() {
  if (!scrapeQueue) scrapeQueue = createScrapeQueue();
  return scrapeQueue;
}

function getOutreachQueue() {
  if (!outreachQueue) outreachQueue = createOutreachPipelineQueue();
  return outreachQueue;
}

// POST / — Create new outreach campaign
router.post('/', async (req, res) => {
  const { name, zipCodes, searchQuery, sequenceId, topN, minScore } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
    res.status(400).json({ error: 'zipCodes must be a non-empty array of zip code strings' });
    return;
  }

  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0) {
    res.status(400).json({ error: 'searchQuery is required' });
    return;
  }

  if (!sequenceId || typeof sequenceId !== 'string') {
    res.status(400).json({ error: 'sequenceId is required' });
    return;
  }

  const validZips = zipCodes.every(
    (z: unknown) => typeof z === 'string' && /^\d{5}$/.test(z),
  );
  if (!validZips) {
    res.status(400).json({ error: 'Each zip code must be a 5-digit string' });
    return;
  }

  // 1. Create scrape_jobs row
  const [scrapeJob] = await db
    .insert(scrapeJobs)
    .values({
      startedBy: req.user!.userId,
      zipCodes,
      searchQuery: searchQuery.trim(),
    })
    .returning();

  // 2. Create outreach_campaigns row
  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      name: name.trim(),
      createdBy: req.user!.userId,
      scrapeJobId: scrapeJob.id,
      sequenceId,
      zipCodes,
      searchQuery: searchQuery.trim(),
      topN: topN != null ? parseInt(topN, 10) : 100,
      minScore: minScore != null ? parseInt(minScore, 10) : 0,
      status: 'scraping',
      stats: {},
    })
    .returning();

  // 3. Enqueue BullMQ scrape job
  const scrapeJobData: ScrapeJobData = {
    jobId: scrapeJob.id,
    zipCodes,
    searchQuery: searchQuery.trim(),
    startedBy: req.user!.userId,
  };

  try {
    await getScrapeQueue().add(`scrape-${scrapeJob.id}`, scrapeJobData, {
      jobId: scrapeJob.id,
    });
  } catch (err) {
    console.error('[Outreach API] Failed to enqueue scrape job to BullMQ:', err);
  }

  // 4. Enqueue outreach-pipeline audit phase (delayed 5 min to let scrape finish)
  const pipelineJobData: OutreachPipelineJobData = {
    campaignId: campaign.id,
    phase: 'audit',
  };

  try {
    await getOutreachQueue().add(`pipeline-audit-${campaign.id}`, pipelineJobData, {
      delay: 5 * 60 * 1000,
    });
  } catch (err) {
    console.error('[Outreach API] Failed to enqueue outreach pipeline job to BullMQ:', err);
  }

  res.status(201).json(campaign);
});

// GET / — List campaigns (paginated, most recent first)
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(outreachCampaigns)
      .orderBy(desc(outreachCampaigns.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(outreachCampaigns),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// GET /:id — Get campaign detail with scrape job stats
router.get('/:id', async (req, res) => {
  const [campaign] = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, req.params.id))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }

  let scrapeJob = null;
  if (campaign.scrapeJobId) {
    const [job] = await db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.id, campaign.scrapeJobId))
      .limit(1);
    scrapeJob = job ?? null;
  }

  res.json({ ...campaign, scrapeJob });
});

// DELETE /:id — Cancel campaign
router.delete('/:id', async (req, res) => {
  const [campaign] = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, req.params.id))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }

  const [updated] = await db
    .update(outreachCampaigns)
    .set({ status: 'cancelled' })
    .where(eq(outreachCampaigns.id, req.params.id))
    .returning();

  res.json(updated);
});

export default router;
