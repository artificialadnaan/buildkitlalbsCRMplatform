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
  const range = (req.query.range as string) || '90d';
  let dateFilter: Date;
  const now = new Date();

  switch (range) {
    case '30d': dateFilter = new Date(now.getTime() - 30 * 86400000); break;
    case '90d': dateFilter = new Date(now.getTime() - 90 * 86400000); break;
    case 'ytd': dateFilter = new Date(now.getFullYear(), 0, 1); break;
    default: dateFilter = new Date(0);
  }

  const [leadStats] = await db.select({
    totalScraped: sql<number>`count(*) filter (where ${companies.source} = 'scraped' and ${companies.createdAt} >= ${dateFilter})::int`,
  }).from(companies);

  const [dealStats] = await db.select({
    created: sql<number>`count(*) filter (where ${deals.createdAt} >= ${dateFilter})::int`,
    won: sql<number>`count(*) filter (where ${deals.status} = 'won' and ${deals.closedAt} >= ${dateFilter})::int`,
    revenue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won' and ${deals.closedAt} >= ${dateFilter}), 0)::int`,
  }).from(deals);

  const totalLeads = leadStats.totalScraped;
  const scraperCost = +(totalLeads * 0.034).toFixed(2);
  const totalDeals = dealStats.created;
  const totalWon = dealStats.won;
  const totalRevenue = dealStats.revenue;

  res.json({
    totalLeadsScraped: totalLeads,
    scraperCost,
    totalDealsCreated: totalDeals,
    totalDealsWon: totalWon,
    totalRevenue,
    leadToDealRate: totalLeads > 0 ? +((totalDeals / totalLeads) * 100).toFixed(1) : 0,
    dealToWonRate: totalDeals > 0 ? +((totalWon / totalDeals) * 100).toFixed(1) : 0,
    costPerLead: totalLeads > 0 ? +(scraperCost / totalLeads).toFixed(2) : 0,
    costPerDeal: totalDeals > 0 ? +(scraperCost / totalDeals).toFixed(2) : 0,
    costPerWon: totalWon > 0 ? +(scraperCost / totalWon).toFixed(2) : 0,
    roi: scraperCost > 0 ? +(((totalRevenue - scraperCost) / scraperCost) * 100).toFixed(0) : 0,
    range,
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
