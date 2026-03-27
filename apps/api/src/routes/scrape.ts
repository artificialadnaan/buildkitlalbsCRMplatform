import { Router } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db, scrapeJobs, users, auditLog, createScrapeQueue, companies, contacts } from '@buildkit/shared';
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
  const { zipCodes, searchQuery, maxLeads, mode, prospectConfig } = req.body;
  const leadLimit = Math.min(Math.max(1, parseInt(maxLeads) || 50), 500);
  const resolvedMode: 'standard' | 'ai-prospect' = mode === 'ai-prospect' ? 'ai-prospect' : 'standard';

  // Validate input
  if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
    res.status(400).json({ error: 'zipCodes must be a non-empty array of zip code strings' });
    return;
  }

  const resolvedQuery = (typeof searchQuery === 'string' && searchQuery.trim().length > 0)
    ? searchQuery.trim()
    : 'local businesses';

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
    searchQuery: resolvedQuery,
    mode: resolvedMode,
  }).returning();

  // Audit log
  await db.insert(auditLog).values({
    userId: req.user!.userId,
    action: 'scrape_started',
    entity: 'scrape_job',
    entityId: job.id,
    changes: { zipCodes, searchQuery: resolvedQuery, maxLeads: leadLimit, mode: resolvedMode },
  });

  // Enqueue BullMQ job
  const jobData: ScrapeJobData = {
    jobId: job.id,
    zipCodes,
    searchQuery: resolvedQuery,
    startedBy: req.user!.userId,
    maxLeads: leadLimit,
    mode: resolvedMode,
    ...(prospectConfig != null && { prospectConfig }),
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
    db
      .select({
        id: scrapeJobs.id,
        startedBy: scrapeJobs.startedBy,
        zipCodes: scrapeJobs.zipCodes,
        searchQuery: scrapeJobs.searchQuery,
        status: scrapeJobs.status,
        totalFound: scrapeJobs.totalFound,
        newLeads: scrapeJobs.newLeads,
        duplicatesSkipped: scrapeJobs.duplicatesSkipped,
        errorMessage: scrapeJobs.errorMessage,
        startedAt: scrapeJobs.startedAt,
        completedAt: scrapeJobs.completedAt,
        createdAt: scrapeJobs.createdAt,
        userName: users.name,
      })
      .from(scrapeJobs)
      .leftJoin(users, eq(scrapeJobs.startedBy, users.id))
      .orderBy(desc(scrapeJobs.createdAt))
      .limit(limit)
      .offset(offset),
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

// Get enriched prospect results for an AI prospect job
router.get('/jobs/:id/prospects', async (req, res) => {
  const { id } = req.params;

  const prospects = await db.select({
    id: companies.id,
    name: companies.name,
    phone: companies.phone,
    website: companies.website,
    city: companies.city,
    state: companies.state,
    industry: companies.industry,
    googleRating: companies.googleRating,
    score: companies.score,
    websiteScore: companies.websiteScore,
    prospectingStatus: companies.prospectingStatus,
    prospectingData: companies.prospectingData,
    contactFirstName: contacts.firstName,
    contactLastName: contacts.lastName,
    contactEmail: contacts.email,
    contactPhone: contacts.phone,
    contactTitle: contacts.title,
  })
    .from(companies)
    .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
    .where(sql`${companies.prospectingData}->>'scrapeJobId' = ${id}`)
    .orderBy(desc(companies.createdAt));

  res.json({ data: prospects });
});

export default router;
