import { Router } from 'express';
import { eq, ilike, sql, and, desc, isNotNull } from 'drizzle-orm';
import { db, companies, contacts, deals, activities, emailSends, users } from '@buildkit/shared';
import { createWebsiteAuditQueue, createEnrichmentQueue } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { calculateLeadScore, rescoreCompany } from '../lib/lead-scoring.js';
import { logAudit } from '../lib/audit.js';
import type { CompanyType, WebsiteAuditJobData, EnrichmentJobData } from '@buildkit/shared';
import type { Queue } from 'bullmq';

let auditQueue: Queue<WebsiteAuditJobData> | null = null;
function getAuditQueue(): Queue<WebsiteAuditJobData> {
  if (!auditQueue) auditQueue = createWebsiteAuditQueue();
  return auditQueue;
}

let enrichmentQueue: Queue<EnrichmentJobData> | null = null;
function getEnrichmentQueue(): Queue<EnrichmentJobData> {
  if (!enrichmentQueue) enrichmentQueue = createEnrichmentQueue();
  return enrichmentQueue;
}

const router = Router();

router.use(authMiddleware);

// List companies with pagination, search, filter, and sort
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const type = req.query.type as CompanyType | undefined;
  const sort = req.query.sort as string | undefined;
  const scrapeJobId = req.query.scrapeJobId as string | undefined;
  const assignedTo = req.query.assignedTo as string | undefined;

  const conditions = [];
  if (search) conditions.push(ilike(companies.name, `%${search}%`));
  if (type) conditions.push(eq(companies.type, type));
  if (scrapeJobId) conditions.push(eq(companies.scrapeJobId, scrapeJobId));
  if (assignedTo) conditions.push(eq(companies.assignedTo, assignedTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy = sort === 'score' ? desc(companies.score) : companies.createdAt;

  const [data, countResult] = await Promise.all([
    db.select({
      id: companies.id,
      name: companies.name,
      type: companies.type,
      website: companies.website,
      phone: companies.phone,
      address: companies.address,
      city: companies.city,
      state: companies.state,
      zip: companies.zip,
      googlePlaceId: companies.googlePlaceId,
      googleRating: companies.googleRating,
      industry: companies.industry,
      employeeCount: companies.employeeCount,
      source: companies.source,
      score: companies.score,
      scrapeJobId: companies.scrapeJobId,
      websiteAudit: companies.websiteAudit,
      websiteScore: companies.websiteScore,
      websiteAuditedAt: companies.websiteAuditedAt,
      assignedTo: companies.assignedTo,
      createdAt: companies.createdAt,
      assignedToName: users.name,
    })
      .from(companies)
      .leftJoin(users, eq(companies.assignedTo, users.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy),
    db.select({ count: sql<number>`count(*)::int` }).from(companies).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// Rescore all companies
router.post('/rescore', async (req, res) => {
  // Fetch all companies and their aggregated contact/deal counts in two queries
  const allCompanies = await db.select().from(companies);

  const aggregates = await db.execute<{
    id: string;
    contact_count: number;
    has_email: number;
    deal_count: number;
  }>(sql`
    SELECT c.id,
      COUNT(DISTINCT ct.id)::int AS contact_count,
      COUNT(DISTINCT CASE WHEN ct.email IS NOT NULL THEN ct.id END)::int AS has_email,
      COUNT(DISTINCT d.id)::int AS deal_count
    FROM companies c
    LEFT JOIN contacts ct ON ct.company_id = c.id
    LEFT JOIN deals d ON d.company_id = c.id
    GROUP BY c.id
  `);

  const aggMap = new Map(aggregates.rows.map(r => [r.id, r]));

  let updated = 0;
  for (const company of allCompanies) {
    const agg = aggMap.get(company.id);
    const contactCount = agg?.contact_count ?? 0;
    const dealCount = agg?.deal_count ?? 0;
    const hasEmail = (agg?.has_email ?? 0) > 0;

    const score = calculateLeadScore(company, contactCount, dealCount, hasEmail);

    if (score !== company.score) {
      await db.update(companies).set({ score }).where(eq(companies.id, company.id));
      updated++;
    }
  }

  res.json({ success: true, total: allCompanies.length, updated });
});

// Bulk assign companies to a user
router.patch('/bulk-assign', async (req, res) => {
  const { ids, assignedTo } = req.body as { ids: string[]; assignedTo: string };
  if (!ids?.length || !assignedTo) { res.status(400).json({ error: 'ids and assignedTo required' }); return; }
  await db.update(companies).set({ assignedTo }).where(sql`${companies.id} = ANY(${ids})`);
  res.json({ success: true, updated: ids.length });
});

// Bulk delete companies (admin only)
router.delete('/bulk', async (req, res) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }
  const { ids } = req.body as { ids: string[] };
  if (!ids?.length) { res.status(400).json({ error: 'ids required' }); return; }
  await db.delete(companies).where(sql`${companies.id} = ANY(${ids})`);
  res.json({ success: true, deleted: ids.length });
});

// Get single company
router.get('/:id', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json(company);
});

// Create company
router.post('/', async (req, res) => {
  // Auto-assign to creating user when source is manual and no assignedTo provided
  const body = req.body;
  if (body.source === 'manual' && !body.assignedTo) {
    body.assignedTo = req.user!.userId;
  }
  // Calculate initial score (no contacts or deals yet for a new company)
  const score = calculateLeadScore(body, 0, 0, false);
  const [company] = await db.insert(companies).values({ ...body, score }).returning();
  logAudit({ userId: req.user!.userId, action: 'create', entity: 'company', entityId: company.id, changes: { after: company } });
  res.status(201).json(company);
});

// Update company
router.patch('/:id', async (req, res) => {
  const id = req.params.id as string;
  const [before] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  const [company] = await db.update(companies)
    .set(req.body)
    .where(eq(companies.id, id))
    .returning();

  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  logAudit({ userId: req.user!.userId, action: 'update', entity: 'company', entityId: id, changes: { before, after: company } });
  res.json(company);
});

// Reassign lead to a different rep
router.patch('/:id/assign', async (req, res) => {
  const id = req.params.id as string;
  const { assignedTo } = req.body as { assignedTo: string | null };

  const [company] = await db.update(companies)
    .set({ assignedTo: assignedTo ?? null })
    .where(eq(companies.id, id))
    .returning();

  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  logAudit({ userId: req.user!.userId, action: 'update', entity: 'company', entityId: id, changes: { after: { assignedTo } } });
  res.json(company);
});

// Delete company (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = req.params.id as string;
  const [deleted] = await db.delete(companies).where(eq(companies.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  logAudit({ userId: req.user!.userId, action: 'delete', entity: 'company', entityId: id, changes: { before: deleted } });
  res.json({ success: true });
});

// Get website audit results for a company
router.get('/:id/audit', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db
    .select({ websiteAudit: companies.websiteAudit, websiteScore: companies.websiteScore, websiteAuditedAt: companies.websiteAuditedAt })
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json(company);
});

// Trigger a manual website re-audit
router.post('/:id/audit', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db
    .select({ id: companies.id, website: companies.website })
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  if (!company.website) {
    res.status(400).json({ error: 'Company has no website URL to audit' });
    return;
  }
  const job = await getAuditQueue().add('audit', { companyId: id, url: company.website });
  res.status(202).json({ success: true, jobId: job.id });
});

// Trigger manual lead enrichment
router.post('/:id/enrich', async (req, res) => {
  const id = req.params.id as string;
  const [company] = await db
    .select({ id: companies.id, website: companies.website, name: companies.name })
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  if (!company.website) {
    res.status(400).json({ error: 'Company has no website URL to enrich from' });
    return;
  }
  await db.update(companies).set({ enrichmentStatus: 'pending' }).where(eq(companies.id, id));
  const job = await getEnrichmentQueue().add('enrich', {
    companyId: id,
    website: company.website,
    companyName: company.name,
  });
  res.status(202).json({ success: true, jobId: job.id });
});

// GET /:id/timeline — Company timeline aggregating activities, email sends, and deal events
router.get('/:id/timeline', async (req, res) => {
  const id = req.params.id as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  const timelineResult = await db.execute(sql`
    SELECT * FROM (
      -- Activities via deals.company_id
      SELECT
        a.id,
        'activity' AS type,
        COALESCE(a.subject, a.type::text) AS title,
        a.body AS description,
        a.created_at AS timestamp,
        json_build_object('activityType', a.type, 'dealId', a.deal_id) AS metadata
      FROM activities a
      INNER JOIN deals d ON a.deal_id = d.id
      WHERE d.company_id = ${id}

      UNION ALL

      -- Activities via contacts.company_id
      SELECT
        a.id,
        'activity' AS type,
        COALESCE(a.subject, a.type::text) AS title,
        a.body AS description,
        a.created_at AS timestamp,
        json_build_object('activityType', a.type, 'contactId', a.contact_id) AS metadata
      FROM activities a
      INNER JOIN contacts c ON a.contact_id = c.id
      WHERE c.company_id = ${id}
        AND a.deal_id IS NULL

      UNION ALL

      -- Email sends via contacts.company_id
      SELECT
        es.id,
        'email_sent' AS type,
        COALESCE(es.subject, 'Email sent') AS title,
        NULL AS description,
        es.sent_at AS timestamp,
        json_build_object('contactId', es.contact_id, 'status', es.status) AS metadata
      FROM email_sends es
      INNER JOIN contacts c ON es.contact_id = c.id
      WHERE c.company_id = ${id}
        AND es.sent_at IS NOT NULL

      UNION ALL

      -- Deals: created event
      SELECT
        d.id,
        'deal_created' AS type,
        'Deal created: ' || d.title AS title,
        NULL AS description,
        d.created_at AS timestamp,
        json_build_object('dealId', d.id, 'value', d.value) AS metadata
      FROM deals d
      WHERE d.company_id = ${id}

      UNION ALL

      -- Deals: won event
      SELECT
        d.id::text || '-won' AS id,
        'deal_won' AS type,
        'Deal won: ' || d.title AS title,
        NULL AS description,
        d.closed_at AS timestamp,
        json_build_object('dealId', d.id, 'value', d.value) AS metadata
      FROM deals d
      WHERE d.company_id = ${id}
        AND d.status = 'won'
        AND d.closed_at IS NOT NULL

      UNION ALL

      -- Deals: lost event
      SELECT
        d.id::text || '-lost' AS id,
        'deal_lost' AS type,
        'Deal lost: ' || d.title AS title,
        d.lost_reason AS description,
        d.closed_at AS timestamp,
        json_build_object('dealId', d.id, 'lostReason', d.lost_reason) AS metadata
      FROM deals d
      WHERE d.company_id = ${id}
        AND d.status = 'lost'
        AND d.closed_at IS NOT NULL
    ) AS timeline
    WHERE timestamp IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM (
      SELECT a.id FROM activities a INNER JOIN deals d ON a.deal_id = d.id WHERE d.company_id = ${id}
      UNION ALL
      SELECT a.id FROM activities a INNER JOIN contacts c ON a.contact_id = c.id WHERE c.company_id = ${id} AND a.deal_id IS NULL
      UNION ALL
      SELECT es.id FROM email_sends es INNER JOIN contacts c ON es.contact_id = c.id WHERE c.company_id = ${id} AND es.sent_at IS NOT NULL
      UNION ALL
      SELECT d.id FROM deals d WHERE d.company_id = ${id}
      UNION ALL
      SELECT d.id FROM deals d WHERE d.company_id = ${id} AND d.status = 'won' AND d.closed_at IS NOT NULL
      UNION ALL
      SELECT d.id FROM deals d WHERE d.company_id = ${id} AND d.status = 'lost' AND d.closed_at IS NOT NULL
    ) AS t
  `);

  const total = parseInt(String((countResult.rows[0] as { total: string }).total)) || 0;

  res.json({ data: timelineResult.rows, total, page, limit });
});

export default router;
