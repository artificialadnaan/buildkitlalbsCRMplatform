import { Router } from 'express';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import {
  db,
  emailSequences,
  sequenceEnrollments,
  emailSends,
  emailEvents,
  companies,
  deals,
  generatedReports,
} from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/reports/sales-performance
router.get('/sales-performance', async (req, res) => {
  // Sequence performance: sends, opens, replies, conversion
  const sequencePerformance = await db
    .select({
      sequenceId: emailSequences.id,
      sequenceName: emailSequences.name,
      totalSends: sql<number>`count(distinct ${emailSends.id})::int`,
      totalOpens: sql<number>`count(distinct case when ${emailEvents.type} = 'open' then ${emailEvents.id} end)::int`,
      totalReplies: sql<number>`count(distinct case when ${sequenceEnrollments.status} = 'paused' and ${sequenceEnrollments.pausedReason} = 'reply_received' then ${sequenceEnrollments.id} end)::int`,
      totalEnrollments: sql<number>`count(distinct ${sequenceEnrollments.id})::int`,
    })
    .from(emailSequences)
    .leftJoin(sequenceEnrollments, eq(sequenceEnrollments.sequenceId, emailSequences.id))
    .leftJoin(emailSends, eq(emailSends.dealId, sequenceEnrollments.dealId))
    .leftJoin(emailEvents, eq(emailEvents.emailSendId, emailSends.id))
    .groupBy(emailSequences.id, emailSequences.name);

  const sequencePerformanceWithRate = sequencePerformance.map(s => ({
    sequenceId: s.sequenceId,
    sequenceName: s.sequenceName,
    totalSends: s.totalSends,
    totalOpens: s.totalOpens,
    totalReplies: s.totalReplies,
    conversionRate: s.totalSends > 0 ? +(s.totalReplies / s.totalSends).toFixed(3) : 0,
  }));

  // Industry response: enrollments + replies per industry
  const industryResponse = await db
    .select({
      industry: companies.industry,
      totalEnrollments: sql<number>`count(distinct ${sequenceEnrollments.id})::int`,
      totalReplies: sql<number>`count(distinct case when ${sequenceEnrollments.status} = 'paused' and ${sequenceEnrollments.pausedReason} = 'reply_received' then ${sequenceEnrollments.id} end)::int`,
    })
    .from(companies)
    .leftJoin(
      sequenceEnrollments,
      sql`${sequenceEnrollments.dealId} in (
        select id from deals where company_id = ${companies.id}
      )`
    )
    .groupBy(companies.industry);

  // Send time analysis: opens grouped by hour_of_day and day_of_week
  const sendTimeRows = await db
    .select({
      dayOfWeek: sql<number>`extract(dow from ${emailEvents.createdAt})::int`,
      hour: sql<number>`extract(hour from ${emailEvents.createdAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(emailEvents)
    .where(eq(emailEvents.type, 'open'))
    .groupBy(
      sql`extract(dow from ${emailEvents.createdAt})`,
      sql`extract(hour from ${emailEvents.createdAt})`
    );

  res.json({
    sequencePerformance: sequencePerformanceWithRate,
    industryResponse,
    sendTimeAnalysis: sendTimeRows,
  });
});

// GET /api/reports/roi
router.get('/roi', async (req, res) => {
  const { from, to } = req.query;

  const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to as string) : new Date();

  const [leadsScrapedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companies)
    .where(and(
      eq(companies.source, 'scraped'),
      gte(companies.createdAt, fromDate),
      lte(companies.createdAt, toDate),
    ));

  const [leadsAuditedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companies)
    .where(and(
      sql`${companies.websiteAuditedAt} is not null`,
      gte(companies.websiteAuditedAt, fromDate),
      lte(companies.websiteAuditedAt, toDate),
    ));

  const [leadsEnrolledResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceEnrollments)
    .where(and(
      gte(sequenceEnrollments.enrolledAt, fromDate),
      lte(sequenceEnrollments.enrolledAt, toDate),
    ));

  const [repliesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceEnrollments)
    .where(and(
      eq(sequenceEnrollments.status, 'paused'),
      eq(sequenceEnrollments.pausedReason, 'reply_received'),
      gte(sequenceEnrollments.enrolledAt, fromDate),
      lte(sequenceEnrollments.enrolledAt, toDate),
    ));

  const [dealsCreatedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deals)
    .where(and(
      gte(deals.createdAt, fromDate),
      lte(deals.createdAt, toDate),
    ));

  const [dealsWonResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${deals.value}), 0)::int`,
    })
    .from(deals)
    .where(and(
      eq(deals.status, 'won'),
      sql`${deals.closedAt} is not null`,
      gte(deals.closedAt, fromDate),
      lte(deals.closedAt, toDate),
    ));

  res.json({
    leadsScraped: leadsScrapedResult.count,
    leadsAudited: leadsAuditedResult.count,
    leadsEnrolled: leadsEnrolledResult.count,
    repliesReceived: repliesResult.count,
    dealsCreated: dealsCreatedResult.count,
    dealsWon: dealsWonResult.count,
    revenue: dealsWonResult.revenue,
  });
});

// GET /api/reports — list generated reports (paginated)
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(generatedReports)
      .orderBy(sql`${generatedReports.generatedAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(generatedReports),
  ]);

  res.json({ data: rows, total, page, limit });
});

// GET /api/reports/:id/download — redirect to file URL
router.get('/:id/download', async (req, res) => {
  const [report] = await db
    .select()
    .from(generatedReports)
    .where(eq(generatedReports.id, req.params.id))
    .limit(1);

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (!report.fileUrl) {
    res.status(404).json({ error: 'No file available for this report' });
    return;
  }

  res.redirect(report.fileUrl);
});

export default router;
